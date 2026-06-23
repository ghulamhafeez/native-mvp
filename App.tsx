import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './screens/HomeScreen';
import AmountScreen from './screens/AmountScreen';
import SubscriptionScreen from './screens/SubscriptionScreen';
import SubscriptionSuccessScreen from './screens/SubscriptionSuccessScreen';

type Screen = 'home' | 'amount' | 'subscription' | 'subscription-success';

type SubscriptionResult = {
  subscriptionId?: string;
  planId: string;
  planName: string;
  status: 'active' | 'cancelled';
};

export default function App() {
  const [screen, setScreen]                         = useState<Screen>('home');
  const [subscriptionResult, setSubscriptionResult] = useState<SubscriptionResult | null>(null);

  switch (screen) {

    case 'amount':
      return (
        <>
          <StatusBar style="dark" />
          <AmountScreen onBack={() => setScreen('home')} />
        </>
      );

    case 'subscription':
      return (
        <>
          <StatusBar style="dark" />
          <SubscriptionScreen
            onSuccess={(result) => {
              setSubscriptionResult(result);
              setScreen('subscription-success');
            }}
            onCancel={() => setScreen('home')}
          />
        </>
      );

    case 'subscription-success':
      return (
        <>
          <StatusBar style="dark" />
          <SubscriptionSuccessScreen
            result={subscriptionResult!}
            onHome={() => setScreen('home')}
          />
        </>
      );

    default: // 'home'
      return (
        <>
          <StatusBar style="dark" />
          <HomeScreen onNavigate={setScreen} />
        </>
      );
  }
}
