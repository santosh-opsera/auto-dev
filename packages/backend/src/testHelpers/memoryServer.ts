import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, disconnectMongo } from '../database/connection.js';

let memoryServer: MongoMemoryServer | undefined;

export async function startMemoryMongo(): Promise<string> {
  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri();
  await connectMongo(uri);
  return uri;
}

export async function stopMemoryMongo(): Promise<void> {
  await disconnectMongo();

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
}
