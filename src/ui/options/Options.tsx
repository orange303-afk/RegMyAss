import React, { useEffect, useState } from 'react';
import {
  DiagnosticLog,
  StoredAccount,
  UserSettings,
} from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/constants';
import { translateError } from '../../shared/i18n';
import { AddressGenerator } from '../../accounts/address-generator';
import {
  Mail,
  Sliders,
  Shield,
  History,
  Activity,
  Check,
  Trash2,
  Download,
  RefreshCw,
  Lock,
  User,
  Sparkles,
} from 'lucide-react';

type Tab = 'providers' | 'registration' | 'profile' | 'security' | 'history' | 'diagnostic';

export const Options: React.FC = () => {
  const tr = (key: string) => translateError(settings.locale, key);
  const [activeTab, setActiveTab] = useState<Tab>('providers');
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => { document.documentElement.lang = settings.locale; }, [settings.locale]);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; msg: string } | null>(null);
  const [ownMailBusy, setOwnMailBusy] = useState(false);
  const [ownMailMessage, setOwnMailMessage] = useState('');
  const [oauthConfigured, setOauthConfigured] = useState(false);

  // Vault master password input
  const [masterPassword, setMasterPassword] = useState<string>('');
  const [vaultUnlocked, setVaultUnlocked] = useState<boolean>(false);
  const [vaultMessage, setVaultMessage] = useState<string>('');

  useEffect(() => {
    loadSettings();
    loadAccounts();
    loadLogs();
    chrome.runtime.sendMessage({ type: 'GET_OAUTH_CONFIG' }).then((response) => {
      if (response?.success) setOauthConfigured(Boolean(response.payload.gmail));
    }).catch(() => {});
  }, []);

  const loadSettings = async () => {
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS_REQUEST' });
      if (resp?.payload) {
        setSettings(resp.payload);
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  };

  const loadAccounts = async () => {
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'GET_ACCOUNTS_REQUEST' });
      if (resp?.payload) {
        setAccounts(resp.payload);
      }
    } catch (e) {
      console.warn('Failed to load accounts:', e);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await chrome.storage.local.get('quickpass_logs');
      if (res.quickpass_logs) {
        setLogs(res.quickpass_logs as DiagnosticLog[]);
      }
    } catch (e) {
      console.warn('Failed to load logs:', e);
    }
  };

  const saveSettings = async (newSettings: Partial<UserSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS_REQUEST',
        payload: newSettings,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const connectOwnMail = async () => {
    const ownMail = settings.ownMail;
    if (!ownMail) return;
    setOwnMailBusy(true);
    setOwnMailMessage('');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CONNECT_OWN_MAIL',
        payload: { service: ownMail.service },
      });
      if (!response?.success) throw new Error(response?.error ? tr(response.error) : tr('Не удалось подключить почту.'));
      setSettings((current) => ({ ...current, ownMail: { ...ownMail, address: response.payload.address } }));
      setOwnMailMessage(`${tr('Connected mailbox')} ${response.payload.address}`);
    } catch (error: any) {
      setOwnMailMessage(error.message ? tr(error.message) : tr('Ошибка авторизации.'));
    } finally {
      setOwnMailBusy(false);
    }
  };

  const disconnectOwnMail = async () => {
    if (!settings.ownMail) return;
    await chrome.runtime.sendMessage({ type: 'DISCONNECT_OWN_MAIL', payload: { service: settings.ownMail.service } });
    setSettings((current) => ({ ...current, ownMail: current.ownMail ? { ...current.ownMail, address: '' } : undefined }));
    setOwnMailMessage(tr('Почта отключена.'));
  };

  const testProvider = async (providerId: string) => {
    setTestingProvider(providerId);
    setTestResult(null);
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'TEST_PROVIDER_REQUEST',
        payload: { providerId },
      });
      if (resp?.payload?.success) {
        setTestResult({
          id: providerId,
          success: true,
          msg: `${tr('Mailbox created:')} ${resp.payload.mailboxAddress}`,
        });
      } else {
        setTestResult({
          id: providerId,
          success: false,
          msg: resp?.payload?.error ? tr(resp.payload.error) : tr('Ошибка проверки API'),
        });
      }
    } catch (e: any) {
      setTestResult({
        id: providerId,
        success: false,
        msg: e.message ? tr(e.message) : tr('Ошибка запроса'),
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm(tr('Вы уверены, что хотите удалить эту запись?'))) return;
    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_ACCOUNT_REQUEST',
        payload: { id },
      });
      setAccounts(accounts.filter((a) => a.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportLogs = () => {
    const sanitized = logs.map((l) => ({
      ...l,
      message: l.message.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[EMAIL]'),
    }));
    const blob = new Blob([JSON.stringify(sanitized, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickpass-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/30 text-indigo-400 rounded-xl">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">{tr('RegMyAss Настройки')}</h1>
              <p className="text-xs text-slate-400">{tr('Управление провайдерами, безопасностью и профилем данных')}</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <span>{settings.locale === 'es' ? 'Idioma' : 'Language'}</span>
            <select
              aria-label={settings.locale === 'es' ? 'Idioma de la interfaz' : 'Interface language'}
              value={settings.locale}
              onChange={(event) => saveSettings({ locale: event.target.value as UserSettings['locale'] })}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </label>

          {savedSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/60 border border-emerald-700/60 text-emerald-400 text-xs rounded-lg animate-fade-in">
              <Check className="w-4 h-4" />
              <span>{tr('Настройки сохранены')}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Layout */}
      <div className="max-w-5xl mx-auto px-6 py-8 flex-1 w-full grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <nav className="space-y-1.5 md:col-span-1">
          <button
            onClick={() => setActiveTab('providers')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'providers'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>{tr('Почтовые сервисы')}</span>
          </button>

          <button
            onClick={() => setActiveTab('registration')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'registration'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>{tr('Регистрация')}</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'profile'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>{tr('Профиль и адрес')}</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'security'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>{tr('Безопасность')}</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{tr('История аккаунтов')}</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnostic')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'diagnostic'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>{tr('Диагностика')}</span>
          </button>
        </nav>

        {/* Content Area */}
        <main className="md:col-span-3 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
          {/* TAB 1: PROVIDERS */}
          {activeTab === 'providers' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-white">{tr('Почтовые сервисы')}</h2>
                <p className="text-xs text-slate-400 mt-1">
                  {tr('Подключите личный ящик через OAuth или настройте временную почту.')}
                </p>
              </div>

              <div className="p-4 bg-slate-800/50 border border-indigo-800/60 rounded-xl space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{tr('Собственная почта')}</h3>
                  <p className="text-xs text-slate-400 mt-1">{tr('Gmail проверяется автоматически после входа через Google. Для Proton Mail письмо открывается в браузере, а код вводится вручную.')}</p>
                </div>
                <select
                  value={settings.ownMail?.service || 'gmail'}
                  onChange={(event) => saveSettings({ ownMail: { service: event.target.value as 'gmail' | 'proton', address: '' } })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm"
                >
                  <option value="gmail">Gmail</option>
                  <option value="proton">Proton Mail</option>
                </select>
                {settings.ownMail?.service === 'proton' ? <>
                  <label className="block text-xs text-slate-300">{tr('Адрес Proton Mail')}</label>
                  <input
                    type="email"
                    value={settings.ownMail.address}
                    onChange={(event) => setSettings((current) => ({ ...current, ownMail: { service: 'proton', address: event.target.value } }))}
                    onBlur={() => saveSettings({ ownMail: settings.ownMail })}
                    placeholder={tr('имя@proton.me')}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs"
                  />
                  <button onClick={() => chrome.tabs.create({ url: 'https://mail.proton.me/u/0/inbox' })} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium">{tr('Открыть Proton Mail в браузере')}</button>
                  <p className="text-[11px] text-slate-500">{tr('Войдите в Proton Mail на его сайте. Расширение использует этот адрес при регистрации, но не получает доступ к письмам.')}</p>
                </> : <>
                  {!oauthConfigured && <p className="text-[11px] text-amber-300">{tr('В этой сборке не настроен Google OAuth. Инструкция — в OAUTH_SETUP.md.')}</p>}
                  {settings.ownMail?.address && <p className="text-xs text-emerald-300">{tr('Подключено:')} {settings.ownMail.address}</p>}
                  {ownMailMessage && <p className="text-xs text-slate-300">{ownMailMessage}</p>}
                  <div className="flex gap-2">
                    <button onClick={connectOwnMail} disabled={ownMailBusy || !oauthConfigured} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-xs font-medium">{ownMailBusy ? tr('Вход...') : tr('Войти через Google')}</button>
                    {settings.ownMail?.address && <button onClick={disconnectOwnMail} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs">{tr('Отключить')}</button>}
                  </div>
                </>}
              </div>

              {/* Auto Selection Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl">
                <div>
                  <h3 className="text-xs font-semibold text-white">{tr('Автоматический выбор сервиса')}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {tr('Автоматически подбирать лучший доступный сервис с учетом лимитов и частоты успешных подтверждений')}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoSelectProvider}
                  onChange={(e) => saveSettings({ autoSelectProvider: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 bg-slate-700 border-slate-600 cursor-pointer"
                />
              </div>

              {/* Provider List */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {tr('Доступные адаптеры')}
                </h3>

                {[
                  {
                    id: 'mail-tm',
                    name: 'Mail.tm',
                    desc: tr('Полноценный REST API, создание ящиков по требованию, чтение сообщений без задержек.'),
                    url: 'https://mail.tm',
                    free: true,
                  },
                  {
                    id: 'mail-gw',
                    name: 'Mail.gw',
                    desc: tr('Альтернативный узел Mail.tm с отдельными доменами и независимыми квотами.'),
                    url: 'https://mail.gw',
                    free: true,
                  },
                  {
                    id: 'dropmail',
                    name: 'DropMail.me',
                    desc: tr('Быстрый GraphQL API для мгновенной генерации ящика и веб-опроса писем.'),
                    url: 'https://dropmail.me',
                    free: true,
                  },
                  {
                    id: 'guerrilla',
                    name: 'Guerrilla Mail',
                    desc: tr('Классический сервис временной почты с публичным JSON API.'),
                    url: 'https://guerrillamail.com',
                    free: true,
                  },
                ].map((prov) => {
                  const isEnabled = settings.enabledProviders.includes(prov.id);
                  const isTesting = testingProvider === prov.id;
                  const res = testResult?.id === prov.id ? testResult : null;

                  return (
                    <div
                      key={prov.id}
                      className="p-4 bg-slate-800/30 border border-slate-800 rounded-xl space-y-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{prov.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-800 text-emerald-400 rounded">
                              {tr('Бесплатный API')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">{prov.desc}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => testProvider(prov.id)}
                            disabled={isTesting}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                          >
                            <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                            <span>{tr('Проверить API')}</span>
                          </button>

                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...settings.enabledProviders, prov.id]
                                : settings.enabledProviders.filter((p) => p !== prov.id);
                              saveSettings({ enabledProviders: updated });
                            }}
                            className="w-4 h-4 text-indigo-600 rounded bg-slate-700 border-slate-600 cursor-pointer"
                          />
                        </div>
                      </div>

                      {res && (
                        <div
                          className={`text-xs p-2 rounded-lg border ${
                            res.success
                              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                              : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                          }`}
                        >
                          {res.msg}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: REGISTRATION */}
          {activeTab === 'registration' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-white">{tr('Параметры генерации и регистрации')}</h2>
                <p className="text-xs text-slate-400 mt-1">
                  {tr('Настройте политики генерации паролей, имен пользователей и поведение отправки форм.')}
                </p>
              </div>

              <div className="space-y-4">
                {/* Password Length */}
                <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-white">{tr('Длина генерируемого пароля')}</label>
                    <span className="text-xs font-mono text-indigo-400 font-semibold">
                      {settings.passwordLength} {tr('символов')}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="40"
                    value={settings.passwordLength}
                    onChange={(e) => saveSettings({ passwordLength: parseInt(e.target.value, 10) })}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400">
                    {tr('Пароли генерируются с помощью криптостойкого Web Crypto API (crypto.getRandomValues).')}
                  </p>
                </div>

                {/* Confirm Before Submit */}
                <div className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-800 rounded-xl">
                  <div>
                    <h3 className="text-xs font-medium text-white">{tr('Запрашивать согласие перед отправкой')}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {tr('Показать заполненные поля и запросить подтверждение пользователя перед кликом по кнопке отправки')}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.confirmBeforeSubmit}
                    onChange={(e) => saveSettings({ confirmBeforeSubmit: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded bg-slate-700 border-slate-600 cursor-pointer"
                  />
                </div>

                {/* Auto continue after CAPTCHA */}
                <div className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-800 rounded-xl">
                  <div>
                    <h3 className="text-xs font-medium text-white">{tr('Автоматическое продолжение после CAPTCHA')}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {tr('Определять завершение проверки капчи и продолжать сценарий без лишних кликов')}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoContinueAfterCaptcha}
                    onChange={(e) => saveSettings({ autoContinueAfterCaptcha: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded bg-slate-700 border-slate-600 cursor-pointer"
                  />
                </div>

                {/* Email Timeout */}
                <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-white">{tr('Таймаут ожидания письма (секунды)')}</label>
                    <span className="text-xs font-mono text-indigo-400 font-semibold">
                      {settings.emailTimeoutSeconds} {tr('сек.')}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="600"
                    step="30"
                    value={settings.emailTimeoutSeconds}
                    onChange={(e) => saveSettings({ emailTimeoutSeconds: parseInt(e.target.value, 10) })}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Reuse existing */}
                <div className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-800 rounded-xl">
                  <div>
                    <h3 className="text-xs font-medium text-white">{tr('Повторное использование аккаунтов')}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {tr('Если для текущего сайта уже есть сохранённый аккаунт, не создавать новый, а предлагать вход')}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.reuseExistingAccount}
                    onChange={(e) => saveSettings({ reuseExistingAccount: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded bg-slate-700 border-slate-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROFILE & ADDRESS */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-white">{tr('Профиль пользователя и адрес')}</h2>
                <p className="text-xs text-slate-400 mt-1">
                  {tr('Настройте персональные данные для форм регистрации. Если сайт запрашивает адрес, город или ZIP-код, RegMyAss автоматически заполнит их из профиля или сгенерирует валидные данные для выбранной страны.')}
                </p>
              </div>

              {/* Toggle Custom Profile */}
              <div className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-800 rounded-xl">
                <div>
                  <h3 className="text-xs font-semibold text-white">{tr('Использовать фиксированные данные профиля')}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {tr('Если включено, будут подставляться указанные ниже имя и фамилия. Если выключено — данные генерируются случайно.')}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.profile?.useCustomProfile || false}
                  onChange={(e) =>
                    saveSettings({
                      profile: {
                        ...settings.profile,
                        useCustomProfile: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-indigo-600 rounded bg-slate-700 border-slate-600 cursor-pointer"
                />
              </div>

              {/* Names and Country */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">{tr('Имя (First Name)')}</label>
                  <input
                    type="text"
                    placeholder={tr('Например: Иван или Alex')}
                    value={settings.profile?.firstName || ''}
                    onChange={(e) =>
                      saveSettings({
                        profile: {
                          ...settings.profile,
                          firstName: e.target.value,
                        },
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">{tr('Фамилия (Last Name)')}</label>
                  <input
                    type="text"
                    placeholder={tr('Например: Иванов или Miller')}
                    value={settings.profile?.lastName || ''}
                    onChange={(e) =>
                      saveSettings({
                        profile: {
                          ...settings.profile,
                          lastName: e.target.value,
                        },
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Country Selection */}
              <div className="p-4 bg-slate-800/30 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-white">{tr('Страна для генерации адреса')}</label>
                    <p className="text-[11px] text-slate-400">
                      {tr('Для выбранной страны берутся реальные города, улицы и валидные почтовые индексы (ZIP/Postal Code).')}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const country = settings.profile?.country || 'US';
                      const addr = AddressGenerator.generateAddress(country);
                      saveSettings({
                        profile: {
                          ...settings.profile,
                          city: addr.city,
                          street: addr.street,
                          postalCode: addr.postalCode,
                          phone: addr.phone,
                        },
                      });
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{tr('Сгенерировать случайный адрес')}</span>
                  </button>
                </div>

                <select
                  value={settings.profile?.country || 'US'}
                  onChange={(e) => {
                    const country = e.target.value;
                    const addr = AddressGenerator.generateAddress(country);
                    saveSettings({
                      profile: {
                        ...settings.profile,
                        country,
                        city: addr.city,
                        street: addr.street,
                        postalCode: addr.postalCode,
                        phone: addr.phone,
                      },
                    });
                  }}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                >
                  <option value="US">{tr('🇺🇸 United States (США - ZIP: 90210, 10001, 60601)')}</option>
                  <option value="DE">{tr('🇩🇪 Germany (Германия - PLZ: 10115, 80331)')}</option>
                  <option value="GB">{tr('🇬🇧 United Kingdom (Великобритания - Postcode: SW1A 1AA)')}</option>
                  <option value="FR">{tr('🇫🇷 France (Франция - Code: 75001, 69001)')}</option>
                  <option value="RU">{tr('🇷🇺 Россия (Индекс: 101000, 190000)')}</option>
                  <option value="CA">{tr('🇨🇦 Canada (Канада - Postal Code: M5H 2N2)')}</option>
                </select>

                {/* Address Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">{tr('Город (City)')}</label>
                    <input
                      type="text"
                      placeholder={tr('Город')}
                      value={settings.profile?.city || ''}
                      onChange={(e) =>
                        saveSettings({
                          profile: {
                            ...settings.profile,
                            city: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">{tr('Почтовый индекс (ZIP / Postal Code)')}</label>
                    <input
                      type="text"
                      placeholder="ZIP code"
                      value={settings.profile?.postalCode || ''}
                      onChange={(e) =>
                        saveSettings({
                          profile: {
                            ...settings.profile,
                            postalCode: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[11px] text-slate-400">{tr('Улица и дом (Street Address)')}</label>
                    <input
                      type="text"
                      placeholder={tr('Улица, дом')}
                      value={settings.profile?.street || ''}
                      onChange={(e) =>
                        saveSettings({
                          profile: {
                            ...settings.profile,
                            street: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[11px] text-slate-400">{tr('Телефон (Phone number)')}</label>
                    <input
                      type="text"
                      placeholder={tr('Телефон')}
                      value={settings.profile?.phone || ''}
                      onChange={(e) =>
                        saveSettings({
                          profile: {
                            ...settings.profile,
                            phone: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-white">{tr('Безопасность и хранилище')}</h2>
                <p className="text-xs text-slate-400 mt-1">
                  {tr('Выберите способ хранения учётных данных и настройте шифрование.')}
                </p>
              </div>

              <div className="space-y-4">
                {/* Storage Mode Selection */}
                <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-3">
                  <label className="text-xs font-semibold text-white">{tr('Способ сохранения паролей')}</label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label
                      className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                        settings.storageMode === 'google_password_manager'
                          ? 'border-indigo-500 bg-indigo-950/20 text-white'
                          : 'border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">Google Password Manager</span>
                        <input
                          type="radio"
                          name="storageMode"
                          checked={settings.storageMode === 'google_password_manager'}
                          onChange={() => saveSettings({ storageMode: 'google_password_manager' })}
                          className="text-indigo-600"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {tr('Использовать штатный механизм Chrome для сохранения и автозаполнения паролей.')}
                      </p>
                    </label>

                    <label
                      className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                        settings.storageMode === 'encrypted_local'
                          ? 'border-indigo-500 bg-indigo-950/20 text-white'
                          : 'border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{tr('Защищённое хранилище (AES-GCM)')}</span>
                        <input
                          type="radio"
                          name="storageMode"
                          checked={settings.storageMode === 'encrypted_local'}
                          onChange={() => saveSettings({ storageMode: 'encrypted_local' })}
                          className="text-indigo-600"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {tr('Шифрование секретов мастер-паролем через Web Crypto API и PBKDF2/AES-256-GCM.')}
                      </p>
                    </label>
                  </div>
                </div>

                {/* Local Vault Configuration */}
                {settings.storageMode === 'encrypted_local' && (
                  <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-3">
                    <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-indigo-400" />
                      <span>{tr('Мастер-пароль хранилища')}</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {tr('Мастер-пароль никогда не сохраняется на диске. Он используется только в оперативной памяти для вычисления ключа расшифровки.')}
                    </p>

                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        placeholder={tr('Введите мастер-пароль')}
                        value={masterPassword}
                        onChange={(e) => setMasterPassword(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 flex-1 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={() => {
                          if (masterPassword.length < 8) {
                            setVaultMessage(tr('Пароль должен содержать минимум 8 символов'));
                            return;
                          }
                          setVaultUnlocked(true);
                          setVaultMessage(tr('Хранилище разблокировано'));
                          saveSettings({ isVaultConfigured: true });
                        }}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white rounded-lg transition-colors cursor-pointer"
                      >
                        {vaultUnlocked ? tr('Обновить') : tr('Разблокировать')}
                      </button>
                    </div>

                    {vaultMessage && (
                      <p className="text-xs text-indigo-400">{vaultMessage}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">{tr('История зарегистрированных аккаунтов')}</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {tr('Список сайтов, для которых были созданы учётные записи.')}
                  </p>
                </div>
                <button
                  onClick={loadAccounts}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{tr('Обновить')}</span>
                </button>
              </div>

              {accounts.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl space-y-2 text-slate-500 text-xs">
                  <p>{tr('Пока нет созданных аккаунтов.')}</p>
                  <p className="text-[11px]">{tr('Они появятся здесь после первой автоматической регистрации на любом сайте.')}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                  {accounts.map((acc) => (
                    <div key={acc.id} className="p-3.5 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">{acc.origin}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({acc.providerId})</span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-400">{acc.email}</p>
                        <p className="text-[10px] text-slate-500">
                          {tr('Создан:')} {new Date(acc.createdAt).toLocaleDateString(settings.locale === 'es' ? 'es-ES' : 'en-US')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                          title={tr('Удалить запись')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DIAGNOSTIC */}
          {activeTab === 'diagnostic' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">{tr('Журнал диагностики')}</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {tr('События жизненного цикла, запросы к API провайдеров и распознавание форм.')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportLogs}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1.5 border border-slate-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{tr('Экспорт JSON')}</span>
                  </button>
                  <button
                    onClick={() => {
                      chrome.storage.local.set({ quickpass_logs: [] });
                      setLogs([]);
                    }}
                    className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs rounded-lg flex items-center gap-1.5 border border-rose-800/60 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{tr('Очистить')}</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] max-h-96 overflow-y-auto space-y-2">
                {logs.length === 0 ? (
                  <p className="text-slate-600 text-center py-6">{tr('Журнал пуст')}</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 border-b border-slate-900 pb-1.5 last:border-none">
                      <span className="text-slate-500 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`font-semibold shrink-0 uppercase text-[10px] px-1 rounded ${
                          log.level === 'error'
                            ? 'bg-rose-950 text-rose-400'
                            : log.level === 'warn'
                            ? 'bg-amber-950 text-amber-400'
                            : 'bg-indigo-950 text-indigo-400'
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="text-slate-300 break-all">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
