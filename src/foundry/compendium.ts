/**
 * Ensure a top-level Folder exists for organizing generated dungeon journals & scenes.
 */
import { MODULE_ID } from "../types.js";

const ROOT_FOLDER_NAME = "Generated Dungeons";

async function findOrCreate(type: string, name: string): Promise<any> {
  const g: any = game;
  const collection = g.folders as any;
  const existing = collection.find((f: any) => f.name === name && f.type === type);
  if (existing) return existing;
  return Folder.create({ name, type, flags: { [MODULE_ID]: { root: true } } });
}

export async function ensureFolders(dungeonName: string): Promise<{
  journalFolder: any;
  sceneFolder: any;
  actorFolder: any;
}> {
  const journalRoot = await findOrCreate("JournalEntry", ROOT_FOLDER_NAME);
  const sceneRoot = await findOrCreate("Scene", ROOT_FOLDER_NAME);
  const actorRoot = await findOrCreate("Actor", ROOT_FOLDER_NAME);

  const journalFolder = await createSubFolder("JournalEntry", dungeonName, journalRoot);
  const sceneFolder = sceneRoot;
  const actorFolder = await createSubFolder("Actor", dungeonName, actorRoot);
  return { journalFolder, sceneFolder, actorFolder };
}

async function createSubFolder(type: string, name: string, parent: any): Promise<any> {
  const g: any = game;
  const existing = g.folders.find(
    (f: any) => f.name === name && f.type === type && f.folder?.id === parent.id,
  );
  if (existing) return existing;
  return Folder.create({ name, type, folder: parent.id });
}
