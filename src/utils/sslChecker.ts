import * as https from 'https';
import * as tls from 'tls';

export interface SSLInfo {
  valid: boolean;
  validFrom: string;
  validTo: string;
  daysRemaining: number; // number tipini kesin olarak belirt
  issuer: string;
}

export const checkSSL = (domain: string): Promise<SSLInfo> => {
  return new Promise((resolve, reject) => {
    const options = {
      host: domain,
      port: 443,
      method: 'GET',
      rejectUnauthorized: false,
      timeout: 10000, // 10 saniye timeout
    };

    const req = https.request(options, (res) => {
      const cert = res.socket as tls.TLSSocket;
      const peerCertificate = cert.getPeerCertificate();

      if (peerCertificate) {
        try {
          const validFrom = new Date(peerCertificate.valid_from);
          const validTo = new Date(peerCertificate.valid_to);
          const now = new Date();

          // Tarihleri UTC'ye çevir
          const validToUTC = Date.UTC(
            validTo.getUTCFullYear(),
            validTo.getUTCMonth(),
            validTo.getUTCDate(),
            validTo.getUTCHours(),
            validTo.getUTCMinutes(),
            validTo.getUTCSeconds()
          );

          const nowUTC = Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            now.getUTCHours(),
            now.getUTCMinutes(),
            now.getUTCSeconds()
          );

          // Kalan günleri hesapla
          const daysRemaining = Math.floor((validToUTC - nowUTC) / (1000 * 60 * 60 * 24));

          console.log('SSL Check Details:', {
            domain,
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
            now: now.toISOString(),
            daysRemaining
          });

          resolve({
            valid: daysRemaining > 0,
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
            daysRemaining,
            issuer: peerCertificate.issuer?.CN || 'Unknown',
          });
        } catch (error) {
          console.error('SSL parsing error:', error);
          reject(new Error('Failed to parse SSL certificate dates'));
        }
      } else {
        reject(new Error('No SSL certificate found'));
      }
    });

    req.on('error', (e) => {
      reject(new Error(`SSL check failed: ${e.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('SSL check timed out'));
    });

    req.end();
  });
};
