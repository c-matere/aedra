import { WordNet } from 'natural';
import { Logger, Injectable } from '@nestjs/common';

export interface WordNetResult {
  intent: string;
  confidence: number;
  route: 'DIRECT' | 'HINT' | 'LLM';
  tokens: string[];
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were',
  'i', 'me', 'my', 'please', 'can', 'you',
  'for', 'to', 'of', 'in', 'on', 'at',
  'na', 'ya', 'wa', 'kwa', 'ni', 'nawe', 'ndio',
]);

const INTENT_SEEDS: Record<string, any> = {
  list_companies: {
    action: ['list', 'show', 'display', 'enumerate', 'get', 'view'],
    entity: ['company', 'companies', 'firm', 'organisation', 'business'],
    swahili: ['orodha', 'onyesha', 'kampuni', 'makampuni']
  },
  select_company: {
    action: ['select', 'choose', 'switch', 'open', 'pick', 'use', 'work'],
    entity: ['company', 'workspace', 'firm'],
    swahili: ['chagua', 'badilisha', 'fungua']
  },
  list_tenants: {
    action: ['list', 'show', 'display', 'enumerate'],
    entity: ['tenants', 'renters', 'occupants', 'residents'],
    swahili: ['orodha', 'onyesha', 'wapangaji']
  },
  get_tenant_details: {
    action: ['get', 'view', 'show', 'find', 'who'],
    entity: ['tenant', 'renter', 'occupant', 'resident', 'details', 'profile', 'info'],
    swahili: ['mpangaji', 'maelezo', 'hali']
  },
  get_property_details: {
    action: ['get', 'view', 'show', 'find'],
    entity: ['property', 'building', 'apartment', 'house', 'details', 'info'],
    swahili: ['nyumba', 'jengo', 'mali', 'maelezo']
  },
  generate_mckinsey_report: {
    action: ['generate', 'create', 'make', 'produce', 'build', 'prepare'],
    entity: ['report', 'summary', 'overview', 'analysis', 'mckinsey', 'strategic'],
    swahili: ['tengeneza', 'andaa', 'ripoti', 'muhtasari', 'uchambuzi']
  },
  check_rent_status: {
    action: ['check', 'view', 'show', 'list', 'who', 'status'],
    entity: ['rent', 'payment', 'paid', 'unpaid', 'arrears', 'collection', 'balance'],
    swahili: ['angalia', 'pango', 'malipo', 'hawajalipa', 'madeni', 'kodi', 'salio']
  },
  send_bulk_reminder: {
    action: ['send', 'remind', 'notify', 'message', 'alert', 'blast'],
    entity: ['reminder', 'notice', 'notification', 'tenants', 'outstanding'],
    swahili: ['tuma', 'kumbushia', 'arifa', 'vikumbusho', 'ujumbe']
  },
  check_vacancy: {
    action: ['check', 'show', 'list', 'find', 'which'],
    entity: ['vacant', 'vacancy', 'empty', 'available', 'free', 'unit', 'units'],
    swahili: ['wazi', 'vitengo', 'angalia', 'nafasi', 'nyumba']
  },
  log_maintenance: {
    action: ['log', 'report', 'add', 'create', 'record', 'fix', 'repair'],
    entity: ['maintenance', 'issue', 'problem', 'broken', 'leak', 'tap', 'sink'],
    swahili: ['andika', 'ripoti', 'tatizo', 'matengenezo', 'imevunjika', 'rekebisha']
  },
  record_payment: {
    action: ['record', 'confirm', 'mark', 'note', 'paid'],
    entity: ['payment', 'sent', 'transferred', 'money', 'cash', 'mpesa'],
    swahili: ['nimetuma', 'nimelipa', 'nimepay', 'malipo', 'pesa', 'stakabadhi']
  },
  emergency_escalation: {
    action: ['help', 'save', 'urgent', 'immediate', 'asap'],
    entity: ['fire', 'flood', 'gas', 'injury', 'blood', 'collapse', 'police', 'ambulance'],
    swahili: ['moto', 'mafuriko', 'gesi', 'msaada', 'umeme', 'haraka']
  }
};

@Injectable()
export class WordNetIntentResolver {
  private readonly logger = new Logger(WordNetIntentResolver.name);
  private readonly wordnet = new WordNet();
  private signatures: Record<string, { action: Set<string>; entity: Set<string>; swahili: Set<string> }> = {};
  private initialized = false;

  constructor() {}

  async initialize() {
    if (this.initialized) return;
    
    try {
      this.logger.log('Initializing WordNet intent signatures...');
      const startTime = Date.now();
      
      // 1. Collect all unique seeds to avoid redundant lookups
      const allActionSeeds = new Set<string>();
      const allEntitySeeds = new Set<string>();
      
      for (const seeds of Object.values(INTENT_SEEDS)) {
        (seeds as any).action.forEach((w: string) => allActionSeeds.add(w));
        (seeds as any).entity.forEach((w: string) => allEntitySeeds.add(w));
      }
      
      this.logger.debug(`Found ${allActionSeeds.size} unique actions and ${allEntitySeeds.size} unique entities.`);

      // 2. Resolve synonyms once - still doing them sequentially to avoid overwhelming WordNet file handles
      const synonymCache = new Map<string, string[]>();
      const allUniqueSeeds = Array.from(new Set([...allActionSeeds, ...allEntitySeeds]));
      
      for (const word of allUniqueSeeds) {
        const synonyms = await this.getSynonyms(word);
        synonymCache.set(word, synonyms);
      }
      
      // 3. Map everything back to signatures
      for (const [intent, seeds] of Object.entries(INTENT_SEEDS)) {
        this.signatures[intent] = {
          action: new Set<string>(),
          entity: new Set<string>(),
          swahili: new Set(seeds.swahili)
        };
        
        for (const word of (seeds as any).action) {
          const synonyms = synonymCache.get(word) || [];
          synonyms.forEach(s => this.signatures[intent].action.add(s));
          this.signatures[intent].action.add(word);
        }
        
        for (const word of (seeds as any).entity) {
          const synonyms = synonymCache.get(word) || [];
          synonyms.forEach(s => this.signatures[intent].entity.add(s));
          this.signatures[intent].entity.add(word);
        }
      }
      
      this.initialized = true;
      this.logger.log(`Initialized ${Object.keys(this.signatures).length} intent signatures in ${Date.now() - startTime}ms.`);
    } catch (e) {
      this.logger.error(`WordNet initialization failed: ${e.message}`);
    }
  }

  private async getSynonyms(word: string): Promise<string[]> {
    return new Promise(resolve => {
      try {
        this.wordnet.lookup(word, results => {
          if (!results) return resolve([]);
          const synonyms = results
            .flatMap(r => r.synonyms)
            .map(s => s.toLowerCase().replace(/_/g, ' '));
          resolve(synonyms);
        });
      } catch (e) {
        resolve([]);
      }
    });
  }

  resolve(message: string): WordNetResult {
    const tokens = this.tokenize(message);
    const scores: Record<string, number> = {};

    for (const [intent, sig] of Object.entries(this.signatures)) {
      let score = 0;
      let actionHit = false;
      let entityHit = false;

      for (const token of tokens) {
        // Swahili hit (direct seeds) - high confidence
        if (sig.swahili.has(token)) {
          score += 0.5;
          // Most Swahili seeds in our dictionary are either action-heavy or entity-heavy
          // but often act as both in short queries.
          actionHit = true; 
          entityHit = true;
        }

        // English action hit
        if (sig.action.has(token)) {
          score += 0.3;
          actionHit = true;
        }

        // English entity hit
        if (sig.entity.has(token)) {
          score += 0.4;
          entityHit = true;
        }
      }

      // Bonus for hitting both action AND entity
      if (actionHit && entityHit) score += 0.2;
      
      scores[intent] = score;
    }

    // Find best match
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    const best = sorted[0];

    const intent = best[0];
    const confidence = best[1];

    let route: 'DIRECT' | 'HINT' | 'LLM' = 'LLM';
    if (confidence > 0.85) route = 'DIRECT';
    else if (confidence > 0.60) route = 'HINT';

    return { intent, confidence, route, tokens };
  }

  private tokenize(message: string): string[] {
    return message
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1) 
      .filter(t => !STOPWORDS.has(t));
  }
}
