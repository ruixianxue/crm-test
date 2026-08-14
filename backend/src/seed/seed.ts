import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { ColumnEntity, ColumnType } from '../columns/column.entity';
import { ContactEntity } from '../contacts/contact.entity';

const CONTACT_COUNT = 500;

const DEFAULT_COLUMNS = [
  { key: 'name', label: 'Name', type: ColumnType.TEXT, position: 0 },
  { key: 'company', label: 'Company', type: ColumnType.TEXT, position: 1 },
  { key: 'phone', label: 'Phone', type: ColumnType.PHONE, position: 2 },
  { key: 'signupDate', label: 'Signup Date', type: ColumnType.DATE, position: 3 },
  { key: 'score', label: 'Score', type: ColumnType.NUMBER, position: 4 },
];

async function run() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USER || 'rodium',
    password: process.env.DB_PASSWORD || 'rodium',
    database: process.env.DB_NAME || 'rodium_crm',
    entities: [ColumnEntity, ContactEntity],
    synchronize: true,
  });

  await dataSource.initialize();
  const columnRepo = dataSource.getRepository(ColumnEntity);
  const contactRepo = dataSource.getRepository(ContactEntity);

  const existingCols = await columnRepo.count();
  if (existingCols === 0) {
    await columnRepo.save(DEFAULT_COLUMNS.map((c) => columnRepo.create(c)));
    console.log(`Seeded ${DEFAULT_COLUMNS.length} columns`);
  } else {
    console.log('Columns already exist, skipping');
  }

  const existingContacts = await contactRepo.count();
  if (existingContacts >= CONTACT_COUNT) {
    console.log(`Already have ${existingContacts} contacts, skipping`);
  } else {
    const toCreate = CONTACT_COUNT - existingContacts;
    const contacts = Array.from({ length: toCreate }).map(() =>
      contactRepo.create({
        data: {
          name: faker.person.fullName(),
          company: faker.company.name(),
          phone: `+33 ${faker.string.numeric(1)} ${faker.string.numeric(2)} ${faker.string.numeric(2)} ${faker.string.numeric(2)} ${faker.string.numeric(2)}`,
          signupDate: faker.date.past({ years: 3 }).toISOString().slice(0, 10),
          score: faker.number.int({ min: 0, max: 100 }),
        },
      }),
    );

    const batchSize = 100;
    for (let i = 0; i < contacts.length; i += batchSize) {
      await contactRepo.save(contacts.slice(i, i + batchSize));
    }
    console.log(`Seeded ${toCreate} fake contacts`);
  }

  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});