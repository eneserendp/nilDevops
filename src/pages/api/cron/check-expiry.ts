import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { sendExpiryNotification } from '../../../utils/emailService';
import { checkSSL } from '../../../utils/sslChecker';
import { Prisma } from '@prisma/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const settings = await prisma.settings.findFirst();
    const sslWarningThreshold = settings?.sslWarningThreshold || 20;
    const domainWarningThreshold = settings?.domainWarningThreshold || 30;
    
    // Saat kontrolünü debug edelim
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const scheduledTime = settings?.cronTime || '09:00';

    console.log({
      systemTime: now.toString(),
      currentTime,
      scheduledTime,
      timezone: process.env.TZ,
    });

    // Sadece saat eşleştiğinde veya hata durumunda log bas
    if (scheduledTime === currentTime) {
      console.log(`🕒 Scheduled time reached: ${scheduledTime}`);
      console.log('🔄 Starting daily SSL updates...');
      
      // Her domain için SSL bilgilerini güncelle
      const allDomains = await prisma.monitoredDomain.findMany();
      console.log(`Found ${allDomains.length} domains to update`);
      
      for (const domain of allDomains) {
        try {
          console.log(`Updating SSL info for ${domain.domain}...`);
          const oldDaysRemaining = (domain.sslInfo as any).daysRemaining;
          
          const updatedSslInfo = await checkSSL(domain.domain);
          
          // SSLInfo'yu Prisma JsonValue formatına çevir
          const sslInfoJson: Prisma.JsonObject = {
            valid: updatedSslInfo.valid,
            validFrom: updatedSslInfo.validFrom,
            validTo: updatedSslInfo.validTo,
            daysRemaining: updatedSslInfo.daysRemaining,
            issuer: updatedSslInfo.issuer
          };

          await prisma.monitoredDomain.update({
            where: { domain: domain.domain },
            data: { 
              sslInfo: sslInfoJson,
              updatedAt: new Date()
            }
          });
          
          console.log(`✅ ${domain.domain}: ${oldDaysRemaining} days -> ${updatedSslInfo.daysRemaining} days`);
        } catch (error) {
          console.error(`❌ Failed to update ${domain.domain}:`, error);
        }
      }
      
      console.log('🏁 Daily SSL updates completed');
    }

    if (scheduledTime !== currentTime) {
      return res.status(200).json({ status: 'waiting' });
    }

    const expiringDomains = await prisma.monitoredDomain.findMany({
      where: {
        OR: [
          // SSL süresi kontrolü
          {
            sslInfo: {
              path: ['daysRemaining'],
              lt: sslWarningThreshold
            }
          },
          // Domain süresi kontrolü
          {
            sslInfo: {
              path: ['domainExpiryDate'],
              // Prisma JSON filtresi için uygun syntax
              gt: ''  // Boş string kontrolü yerine
            }
          }
        ]
      }
    });

    const domainsToNotify = expiringDomains.filter(domain => {
      const sslInfo = domain.sslInfo as any;
      const sslDaysRemaining = sslInfo.daysRemaining;
      
      // Domain expiry days calculation
      const domainExpiryDate = sslInfo.domainExpiryDate ? new Date(sslInfo.domainExpiryDate) : null;
      const now = new Date();
      const domainDaysRemaining = domainExpiryDate 
        ? Math.ceil((domainExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return (
        (sslDaysRemaining > 0 && sslDaysRemaining <= sslWarningThreshold) ||
        (domainDaysRemaining != null && domainDaysRemaining > 0 && domainDaysRemaining <= domainWarningThreshold)
      );
    });

    if (domainsToNotify.length > 0) {
      console.log(`📧 Sending notifications for ${domainsToNotify.length} domains`);
      await sendExpiryNotification(
        domainsToNotify.map(d => ({
          domain: d.domain,
          sslDaysRemaining: (d.sslInfo as any).daysRemaining,
          domainExpiryDate: (d.sslInfo as any).domainExpiryDate,
          registrar: (d.sslInfo as any).registrar
        }))
      );
      console.log('✅ Notifications sent successfully');
    }

    return res.status(200).json({ 
      status: 'completed',
      domainsChecked: domainsToNotify.length,
      emailsSentTo: settings?.recipients?.length || 0
    });
  } catch (error: any) { // Error tipini belirttik
    console.error('Cron job error:', error);
    return res.status(500).json({ 
      error: 'Error in cron job',
      details: error?.message 
    });
  }
}
