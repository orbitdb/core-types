
declare module "@orbitdb/core" {
    import type { HeliaLibp2p } from "helia";
    import type { Libp2p } from "@libp2p/interface";
    import type { PeerId } from "@libp2p/interface";
    import type { TypedEmitter } from 'tiny-typed-emitter';
    import type { PrivateKey } from '@libp2p/interface'


    export function createOrbitDB<T extends Libp2p = Libp2p>(args: {
      ipfs: HeliaLibp2p<T>;
      id?: string;
      identity?: Identity;
      identities?: typeof Identities;
      directory?: string;
    }): Promise<OrbitDB>;

    export type DatabaseEvents = {
      'update': (entry: Entry)=>void;
      'close': ()=>void;
      'drop': ()=>void;
      'join': (peerId: PeerId, heads: Log[])=>void;
      'leave': (peerId: PeerId)=>void;
    }

    export type MetaData = {[key: string]: string|number|boolean};  // Todo: check

    export type BaseDatabase = {
      address: string,
      name: string,
      identity: Identity,
      meta: MetaData,
      close: () => Promise<void>,
      drop: () => Promise<void>,
      addOperation: (bytes: ArrayBuffer) => Promise<string>,
      log: Log,
      sync: Sync,
      peers: string[],
      events: TypedEmitter<DatabaseEvents>,
      access: AccessController,
    }

    export function Documents<T extends string = '_id'>(args?: {
      indexBy: T
    }): ({}) => Promise<BaseDatabase & {
      type: 'documents';
      put: (doc: {[key: string]: string}) => Promise<void>;
      del: (key: string) => Promise<void>,
      get: (key: string) => Promise<{[key: string]: string} | null>,
      // Check iterator type: docs say return type should [string, string, string]
      // https://github.com/orbitdb/orbitdb/blob/main/src/databases/documents.js#L109
      // ...but I think it should be as follows:
      iterator: (args: {amount: number}) => Iterable<[string, string, {[key: string]: string}]>,
      query: (findFn: (doc: {[key: string]: string})=>boolean) => {[key: string]: string}[],
      indexBy: T,
      all: [string, string, {[key: string]: string}][]  // TODO: see above comment on `iterator`
    }>
  
    export function Database(args: {
      ipfs: HeliaLibp2p;
      identity?: Identity;
      address: string;
      name?: string;
      access?: AccessController;
      directory?: string;
      meta?: MetaData;
      headsStorage?: Storage;
      entryStorage?: Storage;
      indexStorage?: Storage;
      referencesCount?: number;
      syncAutomatically?: boolean;
      onUpdate?: (log: Log, entry: Entry) => void;
    }): Promise<BaseDatabase>;
  
    export type Identity = {
      id: string;
      publicKey: string;
      signatures: {
        id: string;
        publicKey: string;
      };
      type: string;
      sign: (identity: Identity, data: string) => Promise<string>;
      verify: (
        signature: string,
        publicKey: string,
        data: string
      ) => Promise<boolean>;
    };
  
    export type OrbitDBDatabaseOptions = Partial<{ 
      type: string;
      meta: MetaData;
      sync: Sync;
      Database: BaseDatabase;
      AccessController: AccessController;
      headsStorage: Storage; 
      entryStorage: Storage; 
      indexStorage: Storage;
      referencesCount: number;
    }>
    export type OrbitDB = {
      id: string;
      open: (
        address: string,
        options?: OrbitDBDatabaseOptions
      ) => ReturnType<typeof Database>;
      stop: ()=>Promise<void>;
      ipfs: HeliaLibp2p;
      directory: string;
      keystore: KeyStoreType;
      identities: IdentitiesType;
      identity: Identity;
      peerId: PeerId;
    };

    export function useAccessController(accessController: { type: string }): void;
    export function isValidAddress(address: unknown): boolean;
  
    export type Log = {
      id: string;
      clock: Clock;
      heads: () => Promise<LogEntry[]>;
      traverse: () => AsyncGenerator<LogEntry, void, unknown>;
    };

    export type Entry = {
      id: string,
      // Payload must be dag-cbor encodable (todo: specify or import a type for this)
      // See https://github.com/orbitdb/orbitdb/blob/main/src/oplog/entry.js#L68C28-L68C36
      payload: any,  
      next: string[],
      refs: string[],
      clock: Clock,
      v: 2
    }

    export type SyncEvents = {
      join: (peerId: PeerId, heads: Entry[]) => void;
      leave: (peerId: PeerId) => void;
      error: (error: Error) => void;
    }

    export type Sync = {
      add: (entry: Entry) => Promise<void>,
      stop: () => Promise<void>,
      start: () => Promise<void>,
      events: TypedEmitter<SyncEvents>,
      peers: Set<string>
    };

    export function AccessControllerGenerator({
      orbitdb,
      identities,
      address,
    }: {
      orbitdb: OrbitDB;
      identities: IdentitiesType;
      address?: string;
    }): Promise<AccessController>;
  
    export class AccessController {
      type: string;
      address: string;
      canAppend: (entry: LogEntry) => Promise<boolean>;
    }
  
    export function useDatabaseType(type: { type: string }): void;
  
    export function IPFSAccessController(args: {
      write: string[];
      storage: Storage;
    }): (args: {
      orbitdb: OrbitDB;
      identities: IdentitiesType;
      address: string;
    }) => Promise<{
      type: "ipfs";
      address: string;
      write: string[];
      canAppend: (entry: LogEntry) => Promise<boolean>;
    }>;
    export function Identities(args: {keystore?: KeyStoreType, path?: string, storage?: Storage, ipfs?: HeliaLibp2p}): Promise<IdentitiesType>;
    export class IdentitiesType {
      createIdentity: (options: object) => Promise<Identity>;
      getIdentity: (hash: string)=>Promise<Identity>;
      verifyIdentity: (identity: Identity) => Promise<boolean>;
      sign: (identity: Identity, data: string) => Promise<string>;
      verify: (signature: string, publicKey: string, data: string) => Promise<string>;
      keystore: KeyStoreType;
    }
    export const Entry:  {
      create: (identity: Identity, id: string, payload: unknown, clock?: Clock, next?: string[], refs?: string[]) => Promise<LogEntry>;
      verify: (identities: IdentitiesType, entry: LogEntry) => Promise<boolean>;
      decode: (bytes: Uint8Array) => Promise<LogEntry>;
      isEntry: (obj: object) => boolean;
      isEqual: (a: LogEntry, b: LogEntry) => boolean;
    };
    export class Storage {
      put: (hash: string, data: any) => Promise<void>;
      get: (hash: string) => Promise<void>;
    }
    export function IPFSBlockStorage(args: {
      ipfs: HeliaLibp2p,
      pin?: boolean,
      timeout?: number,
    }): Promise<Storage>;
    export function LRUStorage(args: { size: number }): Promise<Storage>;
    export function ComposedStorage(...args: Storage[]): Promise<Storage>;
  
    export type Clock = {
      id: string;
      time: number;
    };
  
    export type LogEntry<T = unknown> = {
      id: string;
      payload: { op: string; key: string | null; value?: T };
      next: string[];
      refs: string[];
      clock: Clock;
      v: Number;
      key: string;
      identity: string;
      sig: string;
      hash: string;
    };

    export type KeyValue = BaseDatabase & {
        type: "keyvalue";
        put(key: string, value: unknown): Promise<string>;
        set: KeyValue["put"];
        del(key: string): Promise<string>;
        get(key: string): Promise<unknown | undefined>;
        all(): Promise<{ key: string; value: unknown; hash: string }[]>;
      };

      export function KeyStore (args: {storage?: Storage, path?: string}): Promise<KeyStoreType>;

      export type KeyStoreType = {
        clear: ()=>Promise<void>,
        close: ()=>Promise<void>,
        hasKey: (id: string)=>Promise<boolean>,
        addKey: (id: string, key: string)=>Promise<void>,
        createKey: (id: string)=>Promise<PrivateKey>,
        getKey: (id: string)=>Promise<PrivateKey>,
        getPublic: <T extends 'hex' | 'buffer' = 'hex'>(keys: PrivateKey, options?: {format: T})=>Promise<T extends 'hex' ?  string: Uint8Array>
      }
  }
  