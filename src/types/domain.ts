import { SSLInfo } from '../utils/sslChecker';

export interface SSLInfo {
  valid: boolean;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  issuer: string;
  lastChecked?: string;
  domainExpiryDate?: string;
  registrar?: string;
}

export interface DomainData {
  domain: string;
  sslInfo: SSLInfo;
  addedAt: string;
}
