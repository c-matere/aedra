export interface JengaAuthConfig {
  merchantCode: string;
  consumerSecret: string;
  apiKey: string;
  privateKey: string; // RSA Private Key
}

export interface JengaTokenResponse {
  access_token: string;
  expires_in: string;
  token_type: string;
  issued_at: string;
}

export interface JengaStkPushRequest {
  customer: {
    mobileNumber: string;
    countryCode: string;
  };
  transaction: {
    amount: string;
    description: string;
    type: string;
    reference: string;
  };
}

export interface JengaStkPushResponse {
  status: boolean;
  code: string;
  message: string;
  data?: {
    reference: string;
    status: string;
  };
}

export interface JengaAccountBalanceResponse {
  status: boolean;
  code: string;
  message: string;
  data: {
    balances: Array<{
      amount: string;
      currency: string;
      type: string;
    }>;
  };
}

export interface JengaWebhookPayload {
  transactionId: string;
  amount: string;
  reference: string;
  status: string;
  date: string;
  // Add other fields based on Jenga webhook spec
}
