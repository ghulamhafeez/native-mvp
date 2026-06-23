import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';

type Screen = 'home' | 'amount' | 'subscription' | 'subscription-success';

type Props = {
  onNavigate: (screen: Screen) => void;
};

type MenuCard = {
  icon:        string;
  title:       string;
  description: string;
  screen:      Screen;
  badge?:      string;
};

const MENU_CARDS: MenuCard[] = [
  {
    icon:        '💳',
    title:       'One-Time Payment',
    description: 'Pay any amount instantly with SafePay',
    screen:      'amount',
  },
  {
    icon:        '🔄',
    title:       'Subscription',
    description: 'Choose a recurring plan and subscribe',
    screen:      'subscription',
    badge:       '7 days free',
  },
];

export default function HomeScreen({ onNavigate }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>SafePay</Text>
            <View style={styles.sandboxBadge}>
              <Text style={styles.sandboxText}>SANDBOX</Text>
            </View>
          </View>
          <Text style={styles.welcomeTitle}>Welcome back 👋</Text>
          <Text style={styles.welcomeSub}>What would you like to do today?</Text>
        </View>

        {/* Menu Cards */}
        <View style={styles.cardsSection}>
          <Text style={styles.sectionLabel}>SERVICES</Text>
          {MENU_CARDS.map((card) => (
            <TouchableOpacity
              key={card.screen}
              style={styles.card}
              onPress={() => onNavigate(card.screen)}
              activeOpacity={0.82}
            >
              <View style={styles.cardLeft}>
                <View style={styles.iconBox}>
                  <Text style={styles.cardIcon}>{card.icon}</Text>
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardDesc}>{card.description}</Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                {card.badge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{card.badge}</Text>
                  </View>
                )}
                <Text style={styles.arrow}>›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer note */}
        <Text style={styles.footerNote}>🔒  All transactions secured by SafePay</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#fff' },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 40 },

  // Header
  header:      { marginBottom: 36 },
  logoRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  logoText:    { fontSize: 26, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  sandboxBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sandboxText:  { fontSize: 10, fontWeight: '700', color: '#D97706', letterSpacing: 0.5 },
  welcomeTitle: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 6 },
  welcomeSub:   { fontSize: 15, color: '#6B7280' },

  // Cards
  cardsSection: { marginBottom: 32 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1.2,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  card: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius:   18,
    borderWidth:    1.5,
    borderColor:    '#E5E7EB',
    padding:        18,
    marginBottom:   12,
  },
  cardLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  iconBox:   {
    width: 48, height: 48,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon:  { fontSize: 22 },
  cardText:  { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 3 },
  cardDesc:  { fontSize: 13, color: '#9CA3AF', lineHeight: 18 },

  cardRight: { alignItems: 'flex-end', gap: 6, marginLeft: 8 },
  badge:     {
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#16A34A' },
  arrow:     { fontSize: 22, color: '#9CA3AF', fontWeight: '300', lineHeight: 24 },

  footerNote: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },
});
