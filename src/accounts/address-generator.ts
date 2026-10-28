/**
 * RegMyAss - Realistic Address & Country Data Generator
 * Provides valid postal codes, cities, streets, and phone numbers by country.
 */

export interface AddressData {
  country: string;
  countryCode: string;
  city: string;
  state?: string;
  street: string;
  postalCode: string;
  phone: string;
}

interface CountryPreset {
  name: string;
  code: string;
  phoneCode: string;
  phoneFormat: string;
  cities: Array<{
    name: string;
    state?: string;
    postalCodes: string[];
    streets: string[];
  }>;
}

export const COUNTRY_PRESETS: Record<string, CountryPreset> = {
  US: {
    name: 'United States',
    code: 'US',
    phoneCode: '+1',
    phoneFormat: '(###) ###-####',
    cities: [
      {
        name: 'New York',
        state: 'NY',
        postalCodes: ['10001', '10002', '10010', '10016', '10019'],
        streets: ['Broadway', '5th Avenue', 'Madison Ave', 'Lexington Ave', 'W 42nd St', 'Wall Street'],
      },
      {
        name: 'Los Angeles',
        state: 'CA',
        postalCodes: ['90001', '90012', '90028', '90210', '90045'],
        streets: ['Sunset Blvd', 'Wilshire Blvd', 'Hollywood Blvd', 'Santa Monica Blvd', 'Figueroa St'],
      },
      {
        name: 'Chicago',
        state: 'IL',
        postalCodes: ['60601', '60605', '60611', '60614'],
        streets: ['Michigan Ave', 'State St', 'Wacker Dr', 'Clark St', 'Halsted St'],
      },
      {
        name: 'Austin',
        state: 'TX',
        postalCodes: ['78701', '78702', '78704', '78745'],
        streets: ['Congress Ave', '6th St', 'Lamar Blvd', 'Guadalupe St', 'Barton Springs Rd'],
      },
      {
        name: 'Seattle',
        state: 'WA',
        postalCodes: ['98101', '98104', '98109', '98115'],
        streets: ['Pike St', 'Pine St', '1st Ave', 'Mercer St', 'Westlake Ave'],
      },
    ],
  },
  DE: {
    name: 'Germany',
    code: 'DE',
    phoneCode: '+49',
    phoneFormat: '1## #######',
    cities: [
      {
        name: 'Berlin',
        state: 'Berlin',
        postalCodes: ['10115', '10117', '10178', '10435', '10785'],
        streets: ['Friedrichstraße', 'Unter den Linden', 'Torstraße', 'Kurfürstendamm', 'Alexanderstraße'],
      },
      {
        name: 'München',
        state: 'Bayern',
        postalCodes: ['80331', '80333', '80336', '80539'],
        streets: ['Maximilianstraße', 'Leopoldstraße', 'Sonnenstraße', 'Brienner Straße', 'Sendlinger Str.'],
      },
      {
        name: 'Hamburg',
        state: 'Hamburg',
        postalCodes: ['20095', '20354', '20457', '22767'],
        streets: ['Mönckebergstraße', 'Jungfernstieg', 'Reeperbahn', 'Neuer Wall', 'Große Elbstraße'],
      },
      {
        name: 'Frankfurt am Main',
        state: 'Hessen',
        postalCodes: ['60311', '60313', '60329', '60594'],
        streets: ['Zeil', 'Mainzer Landstraße', 'Goethestraße', 'Kaiserstraße', 'Eschersheimer Landstr.'],
      },
    ],
  },
  GB: {
    name: 'United Kingdom',
    code: 'GB',
    phoneCode: '+44',
    phoneFormat: '7### ######',
    cities: [
      {
        name: 'London',
        state: 'Greater London',
        postalCodes: ['EC1A 1BB', 'W1D 1BS', 'SW1A 1AA', 'WC2N 5DU', 'SE1 7PB'],
        streets: ['Oxford Street', 'Regent Street', 'Baker Street', 'Piccadilly', 'King’s Road'],
      },
      {
        name: 'Manchester',
        state: 'Greater Manchester',
        postalCodes: ['M1 1AE', 'M2 1FB', 'M3 4FP', 'M4 1HQ'],
        streets: ['Deansgate', 'Market Street', 'King Street', 'Portland Street'],
      },
      {
        name: 'Edinburgh',
        state: 'Scotland',
        postalCodes: ['EH1 1YZ', 'EH2 2EQ', 'EH3 9DR'],
        streets: ['Princes Street', 'Royal Mile', 'George Street', 'Lothian Road'],
      },
    ],
  },
  FR: {
    name: 'France',
    code: 'FR',
    phoneCode: '+33',
    phoneFormat: '6 ## ## ## ##',
    cities: [
      {
        name: 'Paris',
        state: 'Île-de-France',
        postalCodes: ['75001', '75008', '75010', '75011', '75015'],
        streets: ['Rue de Rivoli', 'Avenue des Champs-Élysées', 'Boulevard Saint-Germain', 'Rue La Fayette'],
      },
      {
        name: 'Lyon',
        state: 'Auvergne-Rhône-Alpes',
        postalCodes: ['69001', '69002', '69003', '69006'],
        streets: ['Rue de la République', 'Rue Victor Hugo', 'Cours Lafayette', 'Avenue Jean Jaurès'],
      },
      {
        name: 'Marseille',
        state: "Provence-Alpes-Côte d'Azur",
        postalCodes: ['13001', '13002', '13006', '13008'],
        streets: ['La Canebière', 'Rue Paradis', 'Rue Saint-Ferréol', 'Boulevard Longchamp'],
      },
    ],
  },
  RU: {
    name: 'Россия',
    code: 'RU',
    phoneCode: '+7',
    phoneFormat: '(9##) ###-##-##',
    cities: [
      {
        name: 'Москва',
        state: 'Москва',
        postalCodes: ['101000', '119019', '125009', '127006', '115184'],
        streets: ['ул. Тверская', 'ул. Арбат', 'Ленинский проспект', 'пр-т Мира', 'ул. Большая Полянка'],
      },
      {
        name: 'Санкт-Петербург',
        state: 'Санкт-Петербург',
        postalCodes: ['190000', '191025', '197101', '199004'],
        streets: ['Невский проспект', 'Литейный проспект', 'Каменноостровский пр-т', 'Садовая ул.'],
      },
      {
        name: 'Казань',
        state: 'Татарстан',
        postalCodes: ['420000', '420111', '420015'],
        streets: ['ул. Баумана', 'ул. Кремлевская', 'ул. Пушкина', 'ул. Татарстан'],
      },
      {
        name: 'Новосибирск',
        state: 'Новосибирская обл.',
        postalCodes: ['630000', '630099', '630007'],
        streets: ['Красный проспект', 'ул. Ленина', 'ул. Советская', 'ул. Кирова'],
      },
    ],
  },
  CA: {
    name: 'Canada',
    code: 'CA',
    phoneCode: '+1',
    phoneFormat: '(416) ###-####',
    cities: [
      {
        name: 'Toronto',
        state: 'ON',
        postalCodes: ['M5H 2N2', 'M5V 2H1', 'M4Y 1H1', 'M5S 1A1'],
        streets: ['Yonge St', 'Bay St', 'Queen St W', 'King St W', 'Bloor St W'],
      },
      {
        name: 'Vancouver',
        state: 'BC',
        postalCodes: ['V6B 1A1', 'V6E 1B2', 'V6Z 2C1'],
        streets: ['Robson St', 'Granville St', 'Georgia St', 'Burrard St'],
      },
    ],
  },
};

export class AddressGenerator {
  /**
   * Generates a fully valid realistic address for the given country code (or default US).
   */
  public static generateAddress(countryCode: string = 'US'): AddressData {
    const preset = COUNTRY_PRESETS[countryCode.toUpperCase()] || COUNTRY_PRESETS.US;
    const cityObj = preset.cities[Math.floor(Math.random() * preset.cities.length)];
    const postalCode = cityObj.postalCodes[Math.floor(Math.random() * cityObj.postalCodes.length)];
    const streetName = cityObj.streets[Math.floor(Math.random() * cityObj.streets.length)];
    const houseNumber = Math.floor(Math.random() * 190) + 10;
    const street = `${houseNumber} ${streetName}`;

    // Generate formatted phone number
    let phone = preset.phoneFormat;
    phone = phone.replace(/#/g, () => Math.floor(Math.random() * 9 + 1).toString());
    phone = `${preset.phoneCode} ${phone}`;

    return {
      country: preset.name,
      countryCode: preset.code,
      city: cityObj.name,
      state: cityObj.state,
      street,
      postalCode,
      phone,
    };
  }
}
