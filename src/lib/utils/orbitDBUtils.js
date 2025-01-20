import { IPFSAccessController } from '@doichain/orbitdb';
import logger from '$lib/logger.js';

let db = null;
let isClosing = false;

class OrbitDBInterface {
    constructor(orbitdb, network) {
        this.orbitdb = orbitdb;
        this.network = network;
    }

    async open() {
        console.log("this.network",this.network)
        const dbName = this.network.name.indexOf('regtest')!==-1?'nameops-regtest':'nameops';
        
        this.db = await this.orbitdb.open(dbName, {
            type: 'documents',
            create: true,
            overwrite: false,
            directory: './orbitdb/nameops',
            AccessController: IPFSAccessController({
                // write: [this.orbitdb.identity.id],
                write: ["*"]
            }),
        });
        logger.info(`Opened OrbitDB: ${dbName}`);
    }

    async put(docs) {
        if (!Array.isArray(docs)) {
            docs = [docs];
        }
        for (const doc of docs) {
            await this.db.put(doc);
        }
    }

    async all() {
        const allDocs = await this.db.all();
        return allDocs.map(doc => doc.value);
    }

    async close() {
        if (!this.db || isClosing) return;
        isClosing = true;
        try {
            await this.db.close();
            logger.info('OrbitDB database closed successfully');
        } catch (error) {
            logger.error('Error closing OrbitDB database:', error);
        } finally {
            isClosing = false;
        }
    }

    isOpen() {
        // console.log("this.db",this.db)
        // console.log("this.db.isOpen()",this.db.isOpen())
        // console.log("this.db._oplog",this.db._oplog)
        // console.log("this.db._cache",this.db._cache)
        // console.log("this.db._cache._store",this.db._cache._store)
        // console.log("this.db._replicationStatus",this.db._replicationStatus)
        return this.db;
    }
}

export async function getOrCreateDB(orbitdb,network) {
    if (db && db.isOpen && db.isOpen()) {
        return db;
    }
    db = new OrbitDBInterface(orbitdb,network);
    await db.open();
    return db;
}

export async function closeDB() {
    if (!db || isClosing) return;
    isClosing = true;
    try {
        await db.close();
        logger.info('Closed OrbitDB database successfully');
    } catch (error) {
        logger.error('Error closing OrbitDB database:', error);
    } finally {
        db = null;
        isClosing = false;
    }
} 