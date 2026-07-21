// Ambient globals from Foundry VTT. Kept minimal — we intentionally treat most
// Foundry surfaces as `any` and rely on runtime behavior.
/* eslint-disable no-var */
declare var game: any;
declare var ui: any;
declare var canvas: any;
declare var CONFIG: any;
declare var Hooks: any;
declare var foundry: any;
declare var fromUuid: (uuid: string) => Promise<any>;
declare var Scene: any;
declare var JournalEntry: any;
declare var Actor: any;
declare var Folder: any;
declare var FilePicker: any;
declare var ChatMessage: any;
declare var Dialog: any;
declare var Application: any;
declare var Handlebars: any;
