/**
 * A minimal in-memory stand-in for the handful of Mongoose model methods
 * sessionStore.js / conversationStore.js actually call: findOne, find,
 * .sort(), create, findOneAndUpdate, deleteOne, save(), markModified().
 *
 * This is ONLY for fast, offline test runs (test/simulate*.js). Production
 * always uses the real Mongoose models against the real MongoDB Atlas
 * connection — nothing here is used outside the test folder.
 */

function matches(doc, filter) {
  return Object.entries(filter).every(([key, val]) => doc[key] === val);
}

function applySort(docs, sortSpec) {
  const entries = Object.entries(sortSpec);
  return [...docs].sort((a, b) => {
    for (const [field, dir] of entries) {
      const av = a[field];
      const bv = b[field];
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
    }
    return 0;
  });
}

function attachInstanceMethods(doc) {
  doc.save = async function () {
    doc.updatedAt = new Date();
    return doc;
  };
  doc.markModified = function () {};
  return doc;
}

function createFakeModel() {
  const docs = [];
  let nextId = 1;

  return {
    _docs: docs, // exposed for debugging in tests only

    async create(data) {
      const doc = { _id: nextId++, startedAt: new Date(), updatedAt: new Date(), ...data };
      docs.push(doc);
      return attachInstanceMethods(doc);
    },

    findOne(filter) {
      const runFind = () => docs.filter((d) => matches(d, filter));
      return {
        // supports: await Model.findOne(filter).sort({...})
        sort(spec) {
          const [first] = applySort(runFind(), spec);
          return Promise.resolve(first ? attachInstanceMethods(first) : null);
        },
        // supports: await Model.findOne(filter)  (thenable, no .sort())
        then(resolve, reject) {
          try {
            const [first] = runFind();
            resolve(first ? attachInstanceMethods(first) : null);
          } catch (e) {
            reject(e);
          }
        },
      };
    },

    find(filter) {
      const results = docs.filter((d) => matches(d, filter));
      return {
        sort(spec) {
          return Promise.resolve(applySort(results, spec).map(attachInstanceMethods));
        },
      };
    },

    async findOneAndUpdate(filter, update, opts = {}) {
      let doc = docs.find((d) => matches(d, filter));
      if (!doc && opts.upsert) {
        doc = { _id: nextId++, startedAt: new Date(), updatedAt: new Date(), ...filter };
        docs.push(doc);
      }
      if (doc) {
        // Support the one Mongo update operator our stores actually use: $inc
        if (update.$inc) {
          for (const [field, amount] of Object.entries(update.$inc)) {
            doc[field] = (doc[field] || 0) + amount;
          }
        }
        const plainFields = { ...update };
        delete plainFields.$inc;
        Object.assign(doc, plainFields);
        doc.updatedAt = new Date();
      }
      return doc ? attachInstanceMethods(doc) : null;
    },

    async deleteOne(filter) {
      const idx = docs.findIndex((d) => matches(d, filter));
      if (idx >= 0) docs.splice(idx, 1);
    },
  };
}

module.exports = { createFakeModel };
