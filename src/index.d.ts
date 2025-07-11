declare module "@orbitdb/core" {
  import type { HeliaLibp2p } from "helia";
  import type {
    Libp2p,
    PeerId,
    PrivateKey,
    ServiceMap,
  } from "@libp2p/interface";
  import type { TypedEmitter } from "tiny-typed-emitter";
  import type { ByteView } from "multiformats";

  export function createOrbitDB<T extends ServiceMap = ServiceMap>(args: {
    ipfs: HeliaLibp2p<Libp2p<T>>;
    id?: string;
    identity?: Identity;
    identities?: IdentitiesType;
    directory?: string;
  }): Promise<OrbitDB<T>>;

  export type DatabaseEvents = {
    update: (entry: LogEntry) => void;
    close: () => void;
    drop: () => void;
    join: (peerId: PeerId, heads: Log[]) => void;
    leave: (peerId: PeerId) => void;
  };

  export type MetaData = { [key: string]: string | number | boolean }; // Todo: check

  type OpenDatabaseOptions = Partial<{
    type: string;
    meta: MetaData;
    sync: boolean;
    Database: BaseDatabase | DatabaseGenerator; // See https://github.com/orbitdb/orbitdb/blob/main/src/orbitdb.js#L149
    AccessController: typeof AccessControllerGenerator;
    headsStorage: Storage;
    entryStorage: Storage;
    indexStorage: Storage;
    referencesCount: number;
  }>;

  type CreateDatabaseOptions<T extends ServiceMap = ServiceMap> = {
    ipfs: HeliaLibp2p<Libp2p<T>>;
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
    onUpdate?: (log: Log, entry: LogEntry) => void;
  };

  export type InternalDatabase = {
    address: string;
    name: string;
    identity: Identity;
    meta: MetaData;
    close: () => Promise<void>;
    drop: () => Promise<void>;
    addOperation: (op: DagCborEncodable) => Promise<string>;
    all: () => Promise<unknown>;
    log: Log;
    sync: Sync;
    peers: Set<string>;
    events: TypedEmitter<DatabaseEvents>;
    access: AccessController;
  };
  export function Database(
    args: CreateDatabaseOptions,
  ): Promise<InternalDatabase>;

  export type BaseDatabase = InternalDatabase & { type: string };

  export type DatabaseGenerator<T extends BaseDatabase = BaseDatabase> = (
    args: CreateDatabaseOptions,
  ) => Promise<T>;
  export type DatabaseFromGenerator<T> =
    T extends DatabaseGenerator<infer D> ? D : never;
  export type DatabaseGeneratorInitialiser<
    T extends BaseDatabase = BaseDatabase,
  > = { type: T["type"] } & (() => DatabaseGenerator<T>);
  export type DatabaseFromGeneratorInitialiser<T> =
    T extends DatabaseGeneratorInitialiser<infer D> ? D : never;

  export function Documents<T extends string = "_id">(args?: {
    indexBy: T;
  }): (args: CreateDatabaseOptions) => Promise<
    BaseDatabase & {
      type: "documents";
      put: (doc: { [key: string]: string }) => Promise<void>;
      del: (key: string) => Promise<void>;
      get: (key: string) => Promise<{ [key: string]: string } | null>;
      // Check iterator type: docs say return type should [string, string, string]
      // https://github.com/orbitdb/orbitdb/blob/main/src/databases/documents.js#L109
      // ...but I think it should be as follows:
      iterator: (args: {
        amount: number;
      }) => Iterable<[string, string, { [key: string]: string }]>;
      query: (
        findFn: (doc: { [key: string]: string }) => boolean,
      ) => { [key: string]: string }[];
      indexBy: T;
      all: [string, string, { [key: string]: string }][]; // TODO: see above comment on `iterator`
    }
  >;
  export namespace Documents {
    export const type = "documents";
  }

  export type DocumentsDatabase = DatabaseFromGeneratorInitialiser<
    typeof Documents
  >;

  export function KeyValue(): (args: CreateDatabaseOptions) => Promise<
    BaseDatabase & {
      type: "keyvalue";
      put(key: string, value: unknown): Promise<string>;
      set(key: string, value: unknown): Promise<string>;
      del(key: string): Promise<string>;
      get(key: string): Promise<unknown | undefined>;
      all(): Promise<{ key: string; value: unknown; hash: string }[]>;
    }
  >;
  export namespace KeyValue {
    export const type = "keyvalue";
  }

  export function KeyValueIndexed(): (args: CreateDatabaseOptions) => Promise<
    BaseDatabase & {
      type: "keyvalue";
      put(key: string, value: unknown): Promise<string>;
      set(key: string, value: unknown): Promise<string>;
      del(key: string): Promise<string>;
      get(key: string): Promise<unknown | undefined>;
      all(): Promise<{ key: string; value: unknown; hash: string }[]>;
    }
  >;
  export namespace KeyValueIndexed {
    export const type = "keyvalue";
  }

  export type KeyValueDatabase = DatabaseFromGeneratorInitialiser<
    typeof KeyValue
  >;

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
      data: string,
    ) => Promise<boolean>;
  };

  export type OrbitDB<T extends ServiceMap = ServiceMap> = {
    id: string;
    open: (
      address: string,
      options?: OpenDatabaseOptions,
    ) => Promise<BaseDatabase>;
    stop: () => Promise<void>;
    ipfs: HeliaLibp2p<Libp2p<T>>;
    directory: string;
    keystore: KeyStoreType;
    identities: IdentitiesType;
    identity: Identity;
    peerId: PeerId;
  };

  export function useAccessController(
    accessController: typeof AccessControllerSpecifier,
  ): void;

  export function parseAddress(
    address: OrbitDBAddress | string,
  ): OrbitDBAddress;
  export function isValidAddress(address: unknown): boolean;

  export type OrbitDBAddress = {
    protocol: string;
    hash: string;
    address: string;
    toString: () => string;
  };

  export type Log = {
    id: string;
    clock: () => Promise<Clock>;
    heads: () => Promise<LogEntry[]>;
    values: () => Promise<LogEntry[]>;
    get: (hash: string) => Promise<LogEntry>;
    has: (hash: string) => Promise<boolean>;
    append: (
      data: DagCborEncodable,
      options?: { referenceCount?: number },
    ) => Promise<LogEntry>;
    join: (log: Log) => Promise<boolean | void>;
    joinEntry: (entry: LogEntry) => Promise<void>;
    traverse: (
      rootEntries?: LogEntry[],
      shouldStopFn?: (entry: LogEntry) => boolean,
    ) => AsyncGenerator<LogEntry, void, unknown>;
    iterator: (args?: {
      amount?: number;
      gt?: string;
      gte?: string;
      lt?: string;
      lte?: string;
    }) => AsyncGenerator<LogEntry, void, unknown>;
    clear: () => Promise<void>;
    close: () => Promise<void>;
    access: AccessController;
    identity: Identity;
    storage: Storage;
  };

  export type DagCborEncodable =
    | string
    | number
    | null
    | boolean
    | DagCborEncodable[]
    | { [key: string]: DagCborEncodable };

  export type SyncEvents = {
    join: (peerId: PeerId, heads: LogEntry[]) => void;
    leave: (peerId: PeerId) => void;
    error: (error: Error) => void;
  };

  export type Sync = {
    add: (entry: LogEntry) => Promise<void>;
    stop: () => Promise<void>;
    start: () => Promise<void>;
    events: TypedEmitter<SyncEvents>;
    peers: Set<string>;
  };

  export function AccessControllerSpecifier(args: {
    storage?: Storage;
  }): typeof AccessControllerGenerator;

  export function AccessControllerGenerator(args: {
    orbitdb: OrbitDB;
    identities: IdentitiesType;
    address?: string;
  }): Promise<AccessController>;

  export type AccessController = {
    type: string;
    address: string;
    canAppend: (entry: LogEntry) => Promise<boolean>;
  };

  export function useDatabaseType(type: { type: string }): void;

  export function IPFSAccessController(args?: {
    write?: string[];
    storage?: Storage;
  }): (args: {
    orbitdb: OrbitDB;
    identities: IdentitiesType;
    address?: string;
  }) => Promise<
    AccessController & {
      type: "ipfs";
      write: string[];
    }
  >;

  export function OrbitDBAccessController(args?: { write?: string[] }): (args: {
    orbitdb: OrbitDB;
    identities: IdentitiesType;
    address?: string;
    name?: string;
  }) => Promise<
    AccessController & {
      type: "orbitdb";
      write: string[];
      capabilities: () => Promise<{ [key: string]: Set<string> }[]>;
      get: (capability: string) => Promise<Set<string>>;
      grant: (capability: string, key: string) => Promise<void>;
      revoke: (capability: string, key: string) => Promise<void>;
      close: () => Promise<void>;
      drop: () => Promise<void>;
      events: TypedEmitter<DatabaseEvents>;
    }
  >;

  export function Identities<T extends ServiceMap = ServiceMap>(args: {
    keystore?: KeyStoreType;
    path?: string;
    storage?: Storage;
    ipfs?: HeliaLibp2p<Libp2p<T>>;
  }): Promise<{
    createIdentity: (options: object) => Promise<Identity>;
    getIdentity: (hash: string) => Promise<Identity>;
    verifyIdentity: (identity: Identity) => Promise<boolean>;
    sign: (identity: Identity, data: string) => Promise<string>;
    verify: (
      signature: string,
      publicKey: string,
      data: string,
    ) => Promise<string>;
    keystore: KeyStoreType;
  }>;

  export type IdentitiesType = Awaited<ReturnType<typeof Identities>>;

  export namespace Entry {
    function create(
      identity: Identity,
      id: string,
      payload: unknown,
      clock?: Clock,
      next?: string[],
      refs?: string[],
    ): Promise<LogEntry>;
    function verify(
      identities: IdentitiesType,
      entry: LogEntry,
    ): Promise<boolean>;
    function decode(bytes: Uint8Array): Promise<LogEntry>;
    function isEntry(obj: object): boolean;
    function isEqual(a: LogEntry, b: LogEntry): boolean;
  }

  export type Storage = {
    put: (hash: string, data: unknown) => Promise<void>; // Todo: check if DagCborEncodable is appropriate here
    get: (hash: string) => Promise<ByteView<unknown>>;
  };
  export function IPFSBlockStorage<T extends ServiceMap = ServiceMap>(args: {
    ipfs: HeliaLibp2p<Libp2p<T>>;
    pin?: boolean;
    timeout?: number;
  }): Promise<Storage>;
  export function LRUStorage(args: { size: number }): Promise<Storage>;
  export function ComposedStorage(...args: Storage[]): Promise<Storage>;

  export type Clock = {
    id: string;
    time: number;
  };

  export type LogEntry<T extends DagCborEncodable = DagCborEncodable> = {
    id: string;
    // Payload must be dag-cbor encodable (todo: perhaps import a formal type for this)
    // See https://github.com/orbitdb/orbitdb/blob/main/src/oplog/entry.js#L68C28-L68C36
    payload: { op: string; key: string | null; value?: T };
    next: string[];
    refs: string[];
    clock: Clock;
    v: number;
    key: string;
    identity: string;
    sig: string;
    hash: string;
  };

  export function KeyStore(args: {
    storage?: Storage;
    path?: string;
  }): Promise<{
    clear: () => Promise<void>;
    close: () => Promise<void>;
    hasKey: (id: string) => Promise<boolean>;
    addKey: (id: string, key: string) => Promise<void>;
    createKey: (id: string) => Promise<PrivateKey>;
    getKey: (id: string) => Promise<PrivateKey>;
    getPublic: <T extends "hex" | "buffer" = "hex">(
      keys: PrivateKey,
      options?: { format: T },
    ) => Promise<T extends "hex" ? string : Uint8Array>;
  }>;

  export type KeyStoreType = Awaited<ReturnType<typeof KeyStore>>;
}
