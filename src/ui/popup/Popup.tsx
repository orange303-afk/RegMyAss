import React, { useEffect, useRef, useState } from 'react';
import {
  ActiveProcess,
  EmailMessage,
  RegistrationState,
  StoredAccount,
  UserSettings,
} from '../../shared/types';
import { DEFAULT_SETTINGS, DONATE_URL } from '../../shared/constants';
import { translateError } from '../../shared/i18n';
import { buildFailureReportUrl } from '../../shared/report';
import { MessageParser } from '../../email/message-parser';
import {
  Settings as SettingsIcon,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Mail,
  KeyRound,
  RefreshCw,
  ExternalLink,
  LogIn,
  XCircle,
  Copy,
  ChevronDown,
  Eye,
  X,
  Pin,
  PinOff,
  Heart,
} from 'lucide-react';

type PictureInPictureApi = {
  requestWindow(options: { width: number; height: number }): Promise<Window>;
};

export const Popup: React.FC = () => {
  const tr = (key: string) => translateError(settings.locale, key);
  const [activeProcess, setActiveProcess] = useState<ActiveProcess | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => { document.documentElement.lang = settings.locale; }, [settings.locale]);
  const [existingAccount, setExistingAccount] = useState<StoredAccount | null>(null);
  const [currentOrigin, setCurrentOrigin] = useState<string>('');
  const [currentTabId, setCurrentTabId] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedProvider, setSelectedProvider] = useState<string>('auto');
  const [copied, setCopied] = useState<boolean>(false);
  const [showInbox, setShowInbox] = useState<boolean>(false);
  const [inboxMessages, setInboxMessages] = useState<EmailMessage[]>([]);
  const [loadingInbox, setLoadingInbox] = useState<boolean>(false);
  const [activeMessageDetail, setActiveMessageDetail] = useState<EmailMessage | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pinError, setPinError] = useState('');
  const pipWindowRef = useRef<Window | null>(null);
  const [inboxError, setInboxError] = useState<string>('');
  const [detailError, setDetailError] = useState<string>('');
  const [manualCode, setManualCode] = useState('');

  const openMessageDetail = async (msgSummary: EmailMessage) => {
    setDetailError('');
    setActiveMessageDetail(msgSummary);
    // DropMail includes the complete text and HTML in its inbox response.
    // Fetching the same list again can stall while the background is polling.
    if (activeProcess?.providerId === 'dropmail') {
      setLoadingDetail(false);
      const extracted = MessageParser.findOtpCode(
        msgSummary.subject, msgSummary.text || '', msgSummary.html || ''
      );
      if (extracted?.code) {
        setActiveProcess((current) => current ? { ...current, verificationCode: extracted.code } : current);
      }
      return;
    }
    setLoadingDetail(true);
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'GET_FULL_MESSAGE_REQUEST',
        payload: { messageId: msgSummary.id },
      });
      if (resp?.success && resp?.payload?.message) {
        const full = resp.payload.message;
        setActiveMessageDetail(full);
        // Also auto-extract code from this message
        const extracted = MessageParser.findOtpCode(full.subject, full.text || '', full.html || '');
        if (extracted?.code && activeProcess) {
          setActiveProcess({
            ...activeProcess,
            verificationCode: extracted.code,
          });
        }
      } else {
        setDetailError(resp?.error ? tr(resp.error) : tr('Не удалось загрузить письмо. Попробуйте ещё раз.'));
      }
    } catch (e) {
      console.error(e);
      setDetailError(tr('Не удалось загрузить письмо. Попробуйте ещё раз.'));
    } finally {
      setLoadingDetail(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openVerificationLink = async (link: string) => {
    const safeLink = MessageParser.sanitizeUrl(link);
    if (!safeLink) return;
    try {
      await chrome.tabs.create({ url: safeLink, active: true });
    } catch (e) {
      console.error(e);
      setDetailError(tr('Не удалось открыть ссылку подтверждения.'));
    }
  };

  const handleRetryFillOtp = async () => {
    if (!activeProcess?.verificationCode) return;
    try {
      await chrome.runtime.sendMessage({
        type: 'RETRY_FILL_OTP',
        payload: { code: activeProcess.verificationCode },
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchInbox = async (refresh = false) => {
    if (!refresh && showInbox) {
      setShowInbox(false);
      return;
    }
    setShowInbox(true);
    setInboxError('');
    setLoadingInbox(true);
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'GET_INBOX_MESSAGES_REQUEST' });
      if (resp?.success && Array.isArray(resp?.payload?.messages)) {
        setInboxMessages(resp.payload.messages);
      } else {
        setInboxError(resp?.error ? tr(resp.error) : tr('Не удалось получить письма. Попробуйте ещё раз.'));
      }
    } catch (e) {
      console.error(e);
      setInboxError(tr('Не удалось получить письма. Попробуйте ещё раз.'));
    } finally {
      setLoadingInbox(false);
    }
  };

  const refreshState = async () => {
    try {
      const requestedTabId = Number(new URLSearchParams(window.location.search).get('tabId')) || undefined;
      const response = await chrome.runtime.sendMessage({
        type: 'GET_STATE_REQUEST',
        payload: { tabId: requestedTabId },
      });
      if (response?.payload) {
        setActiveProcess(response.payload.activeProcess);
        setCurrentTabId(response.payload.currentTabId || 0);
        setCurrentOrigin(response.payload.currentOrigin || '');
        if (response.payload.settings) {
          setSettings(response.payload.settings);
          setSelectedProvider(response.payload.settings.autoSelectProvider ? 'auto' : response.payload.settings.preferredProviderId || 'mail-tm');
        }
        setExistingAccount(response.payload.existingAccount);
      }
    } catch (e) {
      console.warn('Failed to fetch state from background:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshState();

    const messageListener = (msg: any) => {
      if (msg.type === 'STATE_CHANGED') {
        setActiveProcess(msg.payload.process);
      }
    };

    const settingsListener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && changes.quickpass_settings?.newValue) {
        setSettings({ ...DEFAULT_SETTINGS, ...changes.quickpass_settings.newValue });
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    chrome.storage.onChanged.addListener(settingsListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.storage.onChanged.removeListener(settingsListener);
    };
  }, []);

  const handleStartRegistration = async () => {
    if (!currentTabId || !currentOrigin) return;
    setLoading(true);
    try {
      await chrome.runtime.sendMessage({
        type: 'START_REGISTRATION',
        payload: {
          origin: currentOrigin,
          tabId: currentTabId,
          providerId: selectedProvider === 'auto' ? undefined : selectedProvider,
        },
      });
      await refreshState();
    } catch (err) {
      console.error('Error starting registration:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!activeProcess) return;
    try {
      await chrome.runtime.sendMessage({
        type: 'CONFIRM_SUBMIT',
        payload: { processId: activeProcess.processId },
      });
      await refreshState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualCaptchaDone = async () => {
    if (!activeProcess) return;
    try {
      await chrome.runtime.sendMessage({
        type: 'MANUAL_CAPTCHA_DONE',
        payload: { processId: activeProcess.processId },
      });
      await refreshState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateEmail = async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'SIMULATE_TEST_EMAIL' });
      await refreshState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualConfirmEmail = async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'MANUAL_COMPLETE_EMAIL', payload: { code: manualCode.trim() || undefined } });
      await refreshState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async () => {
    if (!activeProcess) return;
    try {
      await chrome.runtime.sendMessage({
        type: 'CANCEL_PROCESS',
        payload: { processId: activeProcess.processId },
      });
      await refreshState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoginExisting = async () => {
    if (!existingAccount || !currentTabId) return;
    try {
      await chrome.runtime.sendMessage({
        type: 'LOGIN_EXISTING_ACCOUNT',
        payload: { accountId: existingAccount.id, tabId: currentTabId },
      });
    } catch (err) {
      console.error(err);
    }
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const toggleAlwaysOnTop = async () => {
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      return;
    }

    const api = (window as Window & { documentPictureInPicture?: PictureInPictureApi }).documentPictureInPicture;
    if (!api) {
      setPinError(tr('Режим «Поверх окон» недоступен в этом браузере.'));
      return;
    }

    try {
      setPinError('');
      const root = document.getElementById('root');
      if (!root) return;
      const pipWindow = await api.requestWindow({ width: 390, height: 560 });
      pipWindow.document.title = 'RegMyAss';
      for (const sheet of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
        pipWindow.document.head.appendChild(sheet.cloneNode(true));
      }
      pipWindow.document.body.style.margin = '0';
      pipWindow.document.body.style.width = '100%';
      pipWindow.document.body.style.height = '100%';
      pipWindow.document.documentElement.style.height = '100%';
      pipWindow.document.body.appendChild(root);
      pipWindowRef.current = pipWindow;
      setIsPinned(true);
      pipWindow.addEventListener('pagehide', () => {
        document.body.appendChild(root);
        pipWindowRef.current = null;
        setIsPinned(false);
      }, { once: true });
    } catch (error) {
      console.error('Could not open always-on-top window:', error);
      setPinError(tr('Не удалось открыть окно поверх остальных.'));
    }
  };

  const getStateBadge = (state?: RegistrationState) => {
    switch (state) {
      case 'detecting':
        return { label: tr('Анализ страницы...'), color: 'text-amber-400', spin: true };
      case 'creating_email':
        return { label: tr('Создание email...'), color: 'text-blue-400', spin: true };
      case 'filling_form':
        return { label: tr('Заполнение формы...'), color: 'text-indigo-400', spin: true };
      case 'awaiting_consent':
        return { label: tr('Ожидание согласия'), color: 'text-amber-300', spin: false };
      case 'submitting':
        return { label: tr('Отправка формы...'), color: 'text-indigo-400', spin: true };
      case 'awaiting_captcha':
        return { label: tr('Требуется CAPTCHA'), color: 'text-yellow-400', spin: false };
      case 'awaiting_email':
        return { label: tr('Ожидание письма...'), color: 'text-purple-400', spin: true };
      case 'verifying':
        return { label: tr('Подтверждение...'), color: 'text-teal-400', spin: true };
      case 'logging_in':
        return { label: tr('Авторизация...'), color: 'text-blue-400', spin: true };
      case 'completed':
        return { label: tr('Успешно завершено!'), color: 'text-emerald-400', spin: false };
      case 'failed':
        return { label: tr('Ошибка'), color: 'text-rose-400', spin: false };
      case 'cancelled':
        return { label: tr('Отменено'), color: 'text-slate-400', spin: false };
      default:
        return null;
    }
  };

  const statusInfo = activeProcess ? getStateBadge(activeProcess.state) : null;
  const isProcessActive = activeProcess && !['idle', 'completed', 'failed', 'cancelled'].includes(activeProcess.state);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-4 font-sans select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <img src={chrome.runtime.getURL('icons/icon48.png')} alt="" className="w-8 h-8 object-contain" style={{ imageRendering: 'pixelated' }} />
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white">RegMyAss</h1>
            <p className="text-[11px] text-slate-400 truncate max-w-[170px]" title={currentOrigin}>
              {currentOrigin ? currentOrigin.replace(/^https?:\/\//, '') : tr('Вкладка не выбрана')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleAlwaysOnTop}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title={isPinned ? tr('Вернуть обычное окно') : tr('Поверх всех окон')}
            aria-label={isPinned ? tr('Вернуть обычное окно') : tr('Поверх всех окон')}
          >
            {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
          </button>
          <button
            onClick={openOptions}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title={tr('Настройки')}
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {pinError && <p className="pt-2 text-[11px] text-rose-300">{pinError}</p>}

      {/* Main Body */}
      <div className="flex-1 py-3 space-y-3">
        {/* Existing Account Notice */}
        {existingAccount && !isProcessActive && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>{tr('Есть сохранённый аккаунт!')}</span>
            </div>
            <div className="text-xs text-slate-300">
              <p className="font-mono text-[11px] truncate">{existingAccount.email}</p>
            </div>
            <button
              onClick={handleLoginExisting}
              className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              {tr('Войти с сохранённым аккаунтом')}
            </button>
          </div>
        )}

        {/* Active Process Progress Card */}
        {activeProcess && (
          <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">{tr('Текущий статус:')}</span>
              {statusInfo && (
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${statusInfo.color}`}>
                  {statusInfo.spin && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{statusInfo.label}</span>
                </div>
              )}
            </div>

            {/* Generated Details Preview */}
            {activeProcess.accountData && (
              <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800 text-[11px] space-y-1 font-mono text-slate-300">
                <div className="flex items-center gap-1 text-slate-400">
                  <Mail className="w-3 h-3 text-indigo-400" />
                  <span className="truncate">{activeProcess.accountData.email}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <KeyRound className="w-3 h-3 text-emerald-400" />
                  <span>••••••••••••••••</span>
                </div>
              </div>
            )}

            {/* Received Verification Code Card */}
            {activeProcess.verificationCode && (
              <div className="p-3 bg-indigo-950/50 border border-indigo-600/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-indigo-300 font-semibold flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                    {tr('Код подтверждения:')}
                  </span>
                  <button
                    onClick={() => copyCode(activeProcess.verificationCode!)}
                    className="text-[11px] text-indigo-300 hover:text-white flex items-center gap-1 bg-indigo-900/40 px-2 py-0.5 rounded cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copied ? tr('Скопировано!') : tr('Скопировать')}</span>
                  </button>
                </div>
                <div className="text-center py-2 bg-slate-900 border border-slate-800 rounded-lg font-mono text-xl font-bold tracking-widest text-emerald-400 select-all">
                  {activeProcess.verificationCode}
                </div>
                <button
                  onClick={handleRetryFillOtp}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {tr('Вставить код в форму на сайте')}
                </button>
              </div>
            )}

            {activeProcess.verificationLink && (
              <button
                onClick={() => openVerificationLink(activeProcess.verificationLink!)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" /> {tr('Открыть ссылку подтверждения')}
              </button>
            )}

            {/* Mailbox Inbox Accordion */}
            {activeProcess.mailbox && !activeProcess.mailbox.id.startsWith('manual:') && (
              <div className="space-y-1 pt-0.5">
                <button
                  onClick={() => fetchInbox()}
                  className="w-full py-1.5 px-2.5 text-[11px] text-slate-400 hover:text-slate-200 flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{tr('Входящие письма')} ({inboxMessages.length})</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showInbox ? 'rotate-180' : ''}`} />
                </button>

                {showInbox && (
                  <div className="p-2 bg-slate-900/90 border border-slate-800 rounded-lg text-[11px] space-y-2 max-h-56 overflow-y-auto">
                    <button onClick={() => fetchInbox(true)} disabled={loadingInbox} className="flex items-center gap-1 text-indigo-300 hover:text-white disabled:opacity-50 cursor-pointer">
                      <RefreshCw className="w-3 h-3" /> {tr('Обновить письма')}
                    </button>
                    {inboxError && <p className="text-rose-300">{inboxError}</p>}
                    {/* Active Full Message Viewer */}
                    {activeMessageDetail && (
                      <div className="p-2.5 bg-slate-900 border border-indigo-700/80 rounded-xl space-y-2 text-xs">
                        <div className="flex items-start justify-between">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-slate-400 font-mono">{activeMessageDetail.from}</span>
                            <h4 className="font-semibold text-white text-xs">{activeMessageDetail.subject}</h4>
                          </div>
                          <button
                            onClick={() => setActiveMessageDetail(null)}
                            className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Detected Code in this Message */}
                        {(() => {
                          const ext = MessageParser.findOtpCode(
                            activeMessageDetail.subject,
                            activeMessageDetail.text || '',
                            activeMessageDetail.html || ''
                          );
                          if (ext?.code) {
                            return (
                              <div className="p-2 bg-emerald-950/60 border border-emerald-700/60 rounded-lg space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] text-emerald-300 font-semibold">
                                  <span>{tr('Код подтверждения:')}</span>
                                  <span className="font-mono text-sm tracking-widest text-emerald-200 bg-emerald-900/60 px-2 py-0.5 rounded">
                                    {ext.code}
                                  </span>
                                </div>
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => {
                                      chrome.runtime.sendMessage({
                                        type: 'RETRY_FILL_OTP',
                                        payload: { code: ext.code! },
                                      });
                                    }}
                                    className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium rounded transition-colors cursor-pointer"
                                  >
                                    {tr('Вставить в сайт')}
                                  </button>
                                  <button
                                    onClick={() => copyCode(ext.code!)}
                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] rounded transition-colors flex items-center gap-1 cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3" />
                                    {copied ? tr('Скопировано') : tr('Копировать')}
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {(() => {
                          const link = MessageParser.findVerificationLink(
                            activeMessageDetail.html || '',
                            activeMessageDetail.text || '',
                            activeProcess.origin
                          )?.link;
                          return link ? (
                            <button
                              onClick={() => openVerificationLink(link)}
                              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium rounded flex items-center justify-center gap-1.5 cursor-pointer"
                              title={link}
                            >
                              <ExternalLink className="w-3 h-3" /> {tr('Открыть ссылку подтверждения')}
                            </button>
                          ) : null;
                        })()}

                        {/* Full Message Text */}
                        {detailError && <p className="text-rose-300">{detailError}</p>}
                        <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[10px] font-mono text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
                          {activeMessageDetail.text ||
                            activeMessageDetail.html?.replace(/<[^>]+>/g, ' ') ||
                            tr('Текст письма пока недоступен')}
                          {loadingDetail && <div className="text-slate-400">{tr('Загрузка полного письма...')}</div>}
                        </div>
                      </div>
                    )}

                    {loadingInbox ? (
                      <div className="flex items-center justify-center py-2 text-slate-400 gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        <span>{tr('Проверка почты...')}</span>
                      </div>
                    ) : inboxMessages.length === 0 ? (
                      <p className="text-slate-500 text-center py-2">{tr('Новых писем пока нет')}</p>
                    ) : (
                      inboxMessages.map((msg) => (
                        <div
                          key={msg.id}
                          onClick={() => openMessageDetail(msg)}
                          className="p-1.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-600/60 rounded space-y-0.5 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="truncate max-w-[130px] font-semibold text-slate-300">{msg.from}</span>
                            <span>{new Date(msg.receivedAt).toLocaleTimeString(settings.locale === 'es' ? 'es-ES' : settings.locale === 'ru' ? 'ru-RU' : 'en-US')}</span>
                          </div>
                          <p className="font-medium text-white truncate text-[11px]">{msg.subject}</p>
                          {msg.text && <p className="text-slate-400 line-clamp-2 text-[10px]">{msg.text}</p>}
                          <div className="pt-0.5 flex items-center justify-end text-[9px] text-indigo-400 font-medium">
                            <span className="flex items-center gap-0.5">
                              <Eye className="w-3 h-3" />
                              {tr('Открыть и прочитать')}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Consent Needed Button */}
            {activeProcess.state === 'awaiting_consent' && (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] text-amber-300">
                  {tr('Форма заполнена данными выше. Подтвердите отправку:')}
                </p>
                <button
                  onClick={handleConfirmSubmit}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                >
                  {tr('Отправить регистрационную форму')}
                </button>
              </div>
            )}

            {/* CAPTCHA Awaiting Action */}
            {activeProcess.state === 'awaiting_captcha' && (
              <div className="space-y-2 pt-1">
                <div className="p-2 bg-amber-950/40 border border-amber-800/50 rounded-lg text-[11px] text-amber-200 flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>{tr('Обнаружена капча. Пожалуйста, решите её во вкладке сайта.')}</span>
                </div>
                <button
                  onClick={handleManualCaptchaDone}
                  className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  {tr('Я прошёл проверку — продолжить')}
                </button>
              </div>
            )}

            {/* Email Waiting Actions */}
            {activeProcess.state === 'awaiting_email' && (
              <div className="space-y-2 pt-1">
                {activeProcess.mailbox?.id.startsWith('manual:') && <div className="space-y-2">
                  <p className="text-[11px] text-purple-200">{tr('Проверьте свою почту, скопируйте код или перейдите по ссылке подтверждения.')}</p>
                  <input value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder={tr('Код из письма, если есть')} className="w-full p-2 bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg" />
                </div>}
                <div className="p-2.5 bg-purple-950/40 border border-purple-800/50 rounded-xl space-y-1.5 text-[11px] text-purple-200">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium text-purple-300">
                      <Mail className="w-3.5 h-3.5 animate-pulse text-purple-400" />
                      {activeProcess.mailbox?.id.startsWith('manual:') ? tr('Ожидание ручного подтверждения') : tr('Опрос входящих писем...')}
                    </span>
                    {!activeProcess.mailbox?.id.startsWith('manual:') && <span className="font-mono text-[10px] text-purple-300">
                      {activeProcess.emailWaitSeconds || 0}s / {settings.emailTimeoutSeconds}s
                    </span>}
                  </div>
                  {!activeProcess.mailbox?.id.startsWith('manual:') && <div className="w-full bg-purple-950/80 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          (((activeProcess.emailWaitSeconds || 0) / settings.emailTimeoutSeconds) * 100)
                        )}%`,
                      }}
                    />
                  </div>}
                  {!activeProcess.mailbox?.id.startsWith('manual:') && <p className="text-[10px] text-purple-400 leading-tight">{tr('Письмо автоматически опрашивается. Если сайт не отправляет письмо или вы тестируете:')}</p>}
                </div>

                <div className="space-y-1.5">
                  {!activeProcess.mailbox?.id.startsWith('manual:') && <button
                    onClick={handleSimulateEmail}
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>{tr('⚡ Смоделировать письмо (Тест)')}</span>
                  </button>}

                  <button
                    onClick={handleManualConfirmEmail}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{activeProcess.emailBeforeSubmit
                      ? (manualCode.trim() ? tr('Вставить код и продолжить') : tr('Я подтвердил по ссылке — продолжить'))
                      : (manualCode.trim() ? tr('Вставить код и завершить') : tr('Я подтвердил по ссылке — завершить'))}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {activeProcess.state === 'failed' && (
              <div className="space-y-2 pt-1">
                <div className="p-2.5 bg-rose-950/50 border border-rose-800/70 rounded-xl text-rose-200 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span className="leading-relaxed">{activeProcess.lastError ? tr(activeProcess.lastError) : tr('Произошла ошибка при регистрации.')}</span>
                </div>
                <button
                  onClick={() => chrome.tabs.create({ url: buildFailureReportUrl(activeProcess, chrome.runtime.getManifest().version) })}
                  className="w-full py-1.5 bg-indigo-900/70 hover:bg-indigo-800 text-indigo-100 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {tr('Сообщить о проблеме')}
                </button>
                <p className="text-[10px] text-slate-400 leading-relaxed">{tr('Откроется черновик GitHub. Проверьте его перед отправкой; адрес почты, пароль и код не добавляются автоматически.')}</p>
                <button
                  onClick={handleCancel}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {tr('Попробовать снова')}
                </button>
              </div>
            )}

            {/* Cancel Action */}
            {isProcessActive && (
              <button
                onClick={handleCancel}
                className="w-full py-1 text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center gap-1 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                {tr('Отменить регистрацию')}
              </button>
            )}
          </div>
        )}

        {/* Start Registration Section when Idle */}
        {!isProcessActive && (
          <div className="space-y-3">
            {/* Email Provider Selector */}
            <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
                <span>{tr('Почта для регистрации')}</span>
                {selectedProvider === 'auto' && (
                  <span className="text-[10px] text-indigo-400 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800/40">
                    {tr('Автовыбор')}
                  </span>
                )}
              </label>

                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="auto">{tr('Автовыбор временной почты')}</option>
                  {settings.ownMail?.address && <option value="own-mail">{tr('Собственная почта')}: {settings.ownMail.address}</option>}
                  <option value="mail-tm">{tr('Mail.tm (Быстрый & надёжный)')}</option>
                  <option value="mail-gw">{tr('Mail.gw (Зеркало Mail.tm)')}</option>
                  <option value="dropmail">DropMail.me (GraphQL)</option>
                  <option value="guerrilla">{tr('Guerrilla Mail (Классический)')}</option>
                  <option value="smails">smails</option>
                  <option value="maildrop">Maildrop</option>
                </select>
              {!settings.ownMail?.address && <button onClick={openOptions} className="text-[11px] text-indigo-300 hover:text-white">{tr('Настроить собственную почту →')}</button>}
            </div>

            {/* Main Action Button */}
            <button
              onClick={handleStartRegistration}
              disabled={loading || !currentOrigin}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>{tr('Зарегистрироваться в 1 клик')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
        <span>RegMyAss v{chrome.runtime.getManifest().version}</span>
        <button
          type="button"
          onClick={() => chrome.tabs.create({ url: DONATE_URL })}
          className="text-rose-300 hover:text-rose-200 flex items-center gap-1 transition-colors"
          aria-label={tr('Поддержать проект')}
        >
          <Heart className="w-3 h-3" />
          <span>{tr('Поддержать проект')}</span>
        </button>
        <button
          onClick={openOptions}
          className="hover:text-slate-400 flex items-center gap-1 transition-colors"
        >
          <span>{tr('Настройки')}</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
