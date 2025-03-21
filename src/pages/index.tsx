import Head from 'next/head'
import { useState } from 'react'
import { MagnifyingGlassIcon, GlobeAltIcon, ShieldCheckIcon, ClockIcon, CogIcon } from '@heroicons/react/24/outline'
import { SSLInfo } from '../utils/sslChecker'
import { AddDomainModal } from '../components/AddDomainModal';
import { DomainList } from '../components/DomainList';
import { useDomains } from '../context/DomainContext';
import Link from 'next/link';

export default function Home() {
  const [domain, setDomain] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [sslInfo, setSSLInfo] = useState<SSLInfo | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false);
  const { addDomain } = useDomains();

  const handleSearch = async () => {
    if (!domain) return;
    
    setIsSearching(true);
    setError(null);
    setSSLInfo(undefined); // Reset SSL info
    
    try {
      const response = await fetch('/api/check-ssl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error);
        setShowModal(true); // Hata durumunda da modalı aç
      } else {
        setSSLInfo(data);
        setShowModal(true);
      }
    } catch (err: any) { // Error tipini belirttik
      setError(err?.message || 'An unexpected error occurred');
      setShowModal(true); // Hata durumunda da modalı aç
    } finally {
      setIsSearching(false);
    }
  }

  const handleAddDomain = (manualData?: { validUntil: string; issuer: string }) => {
    if (domain) {
      if (manualData) {
        // Manuel girilen verilerle SSL bilgisi oluştur
        const manualSslInfo: SSLInfo = {
          valid: true,
          validFrom: new Date().toISOString(),
          validTo: new Date(manualData.validUntil).toISOString(),
          daysRemaining: Math.floor((new Date(manualData.validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          issuer: manualData.issuer
        };
        addDomain(domain, manualSslInfo);
      } else if (sslInfo) {
        addDomain(domain, sslInfo);
      }
      setShowModal(false);
    }
  };

  return (
    <>
      <Head>
        <title>Domain Checker Dashboard</title>
        <meta name="description" content="Modern Domain Checker Dashboard" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      
      <main className="min-h-screen bg-[#0F172A] p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="glass-effect rounded-2xl p-6 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <GlobeAltIcon className="w-6 h-6 text-blue-500" />
              </div>
              <h1 className="text-2xl font-semibold text-white">Domain Checker</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/settings"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <CogIcon className="w-6 h-6 text-gray-400 hover:text-white" />
              </Link>
              <div className="px-4 py-2 rounded-xl glass-effect text-sm text-blue-200">
                {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="glass-effect rounded-2xl p-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="Enter domain name..."
                  className="w-full px-6 py-4 bg-[#1E293B] rounded-xl text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-8 py-4 bg-blue-500 hover:bg-blue-600 rounded-xl text-white font-medium transition-all flex items-center gap-2"
              >
                <MagnifyingGlassIcon className={`w-5 h-5 ${isSearching ? 'animate-spin' : ''}`} />
                {isSearching ? 'Checking...' : 'Check SSL'}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="glass-effect rounded-2xl p-4 mb-6 bg-red-500/10 border border-red-500/20">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="glass-effect rounded-2xl p-6 card-hover">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <ShieldCheckIcon className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-200">SSL Status</h3>
                  <p className={`text-3xl font-bold mt-1 ${
                    sslInfo && sslInfo.daysRemaining > 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {sslInfo ? (sslInfo.daysRemaining > 0 ? 'Valid' : 'Expired') : '--'}
                  </p>
                </div>
              </div>
              {sslInfo && (
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${sslInfo.daysRemaining > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, Math.max(0, (sslInfo.daysRemaining / 90) * 100))}%` }}
                  />
                </div>
              )}
            </div>

            <div className="glass-effect rounded-2xl p-6 card-hover">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <ClockIcon className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-200">Issuer</h3>
                  <p className="text-xl font-bold text-blue-500 mt-1">
                    {sslInfo?.issuer || '--'}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-effect rounded-2xl p-6 card-hover">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-purple-500">!</span>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-200">Expiry</h3>
                  <p className="text-3xl font-bold text-purple-500 mt-1">
                    {sslInfo ? `${sslInfo.daysRemaining} days` : '--'}
                  </p>
                </div>
              </div>
              {sslInfo && (
                <p className="text-sm text-gray-400 mt-2">
                  Valid until: {new Date(sslInfo.validTo).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Domain List */}
          <DomainList />
          
          {/* Add Domain Modal */}
          <AddDomainModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            onConfirm={handleAddDomain}
            domain={domain}
            sslInfo={sslInfo}
            error={error}
          />
        </div>
      </main>
    </>
  )
}
