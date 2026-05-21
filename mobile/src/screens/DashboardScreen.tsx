import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Trading Pro</Text>
        <View style={styles.proBadge}>
          <Text style={styles.proText}>PRO</Text>
        </View>
      </View>
      
      <View style={styles.portfolioCard}>
        <Text style={styles.cardLabel}>Total Portfolio Value</Text>
        <View style={styles.balanceRow}>
          <Text style={styles.balance}>$125,430.50</Text>
          <Text style={styles.profitText}>+$450.20</Text>
        </View>
        <View style={styles.chartPlaceholder}>
          <Text style={styles.placeholderText}>Chart Placeholder</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Active Strategies</Text>
      <View style={styles.strategyCard}>
        <Text style={styles.strategyName}>SMA Crossover</Text>
        <Text style={styles.strategyDetail}>AAPL • 1h</Text>
        <View style={styles.strategyMetrics}>
          <Text style={styles.strategyLabel}>Return:</Text>
          <Text style={styles.strategyReturn}>+12.5%</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 40 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  proBadge: { backgroundColor: '#064e3b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  proText: { color: '#34d399', fontSize: 12, fontWeight: 'bold' },
  portfolioCard: { backgroundColor: '#18181b', padding: 20, borderRadius: 12, marginBottom: 24 },
  cardLabel: { color: '#a1a1aa', fontSize: 12, textTransform: 'uppercase' },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 },
  balance: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  profitText: { color: '#34d399', fontSize: 16, fontWeight: '500' },
  chartPlaceholder: { height: 150, backgroundColor: '#27272a', borderRadius: 8, marginTop: 16, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#71717a' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 16 },
  strategyCard: { backgroundColor: '#18181b', padding: 16, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#10b981' },
  strategyName: { color: '#fff', fontSize: 16, fontWeight: '500' },
  strategyDetail: { color: '#71717a', fontSize: 12, marginTop: 4 },
  strategyMetrics: { flexDirection: 'row', marginTop: 12, alignItems: 'center' },
  strategyLabel: { color: '#a1a1aa', fontSize: 12, marginRight: 4 },
  strategyReturn: { color: '#34d399', fontSize: 14, fontWeight: 'bold' }
});
