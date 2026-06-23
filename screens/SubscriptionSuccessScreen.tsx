import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native';

type SubscriptionResult = {
  subscriptionId?: string;
  planId: string;
  planName: string;
  status: 'active' | 'cancelled';
};

type Props = {
  result: SubscriptionResult;
  onManage?: () => void;
  onHome?:   () => void;
};

export default function SubscriptionSuccessScreen({ result, onManage, onHome }: Props) {
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue:         1,
        useNativeDriver: true,
        tension:         60,
        friction:        6,
      }),
      Animated.timing(opacityAnim, {
        toValue:         1,
        duration:        300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.content}>
        {/* Animated checkmark */}
        <Animated.View
          style={[styles.iconCircle, { transform: [{ scale: scaleAnim }] }]}
        >
          <Text style={styles.checkmark}>✓</Text>
        </Animated.View>

        <Animated.View style={{ opacity: opacityAnim }}>
          <Text style={styles.title}>You're all set!</Text>
          <Text style={styles.subtitle}>
            Your <Text style={styles.planName}>{result.planName}</Text> subscription
            is now active.
          </Text>

          {result.subscriptionId && (
            <View style={styles.idBox}>
              <Text style={styles.idLabel}>Subscription ID</Text>
              <Text style={styles.idValue} numberOfLines={1} ellipsizeMode="middle">
                {result.subscriptionId}
              </Text>
            </View>
          )}

          <View style={styles.featureList}>
            <FeatureRow text="Billing managed securely by SafePay" />
            <FeatureRow text="Cancel anytime from your account" />
            <FeatureRow text="Instant access to all plan features" />
          </View>
        </Animated.View>
      </View>

      {/* Action buttons */}
      <Animated.View style={[styles.footer, { opacity: opacityAnim }]}>
        {onManage && (
          <TouchableOpacity style={styles.manageBtn} onPress={onManage} activeOpacity={0.85}>
            <Text style={styles.manageBtnText}>Manage Subscription</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.homeBtn, !onManage && styles.homeBtnFull]}
          onPress={onHome}
          activeOpacity={0.85}
        >
          <Text style={styles.homeBtnText}>Go to Home</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

function FeatureRow({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureDot}>●</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#111827',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  checkmark: {
    fontSize: 44,
    color: '#fff',
    fontWeight: '800',
    lineHeight: 52,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  planName: {
    color: '#111827',
    fontWeight: '700',
  },

  idBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    width: '100%',
  },
  idLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  idValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },

  featureList: {
    width: '100%',
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureDot: {
    fontSize: 8,
    color: '#111827',
    marginTop: 5,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  manageBtn: {
    borderWidth: 1.5,
    borderColor: '#111827',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  manageBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  homeBtn: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  homeBtnFull: { marginTop: 0 },
  homeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
