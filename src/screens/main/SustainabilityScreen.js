// author: caitriona mccann
// sustainability insights screen - shows environmental impact over time with charts and trends

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { colors, typography, spacing, borderRadius, shadows, getGradeColor } from '../../theme/theme';
import { fetchSustainabilityInsights } from '../../services/api';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - spacing.lg * 2;

const chartConfig = {
  backgroundColor: colors.surface,
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalCount: 0,
  color: (opacity = 1) => `rgba(26, 107, 74, ${opacity})`,
  labelColor: () => colors.textSecondary,
  style: { borderRadius: borderRadius.md },
  propsForDots: {
    r: '5',
    strokeWidth: '2',
    stroke: colors.primary,
  },
  propsForBackgroundLines: {
    strokeDasharray: '',
    stroke: colors.border,
    strokeWidth: 1,
  },
};

const SustainabilityScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [data, setData] = useState({ trends: [], totals: {}, grades: [], topFibers: [] });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [period])
  );

  const loadData = async () => {
    setLoading(true);
    const result = await fetchSustainabilityInsights(period);
    if (result.success) {
      setData(result);
    }
    setLoading(false);
  };

  const formatPeriodLabel = (dateStr) => {
    const date = new Date(dateStr);
    if (period === 'month') {
      return date.toLocaleDateString('en', { month: 'short' });
    }
    return date.toLocaleDateString('en', { day: 'numeric', month: 'short' });
  };

  const { totals, trends, grades, topFibers } = data;

  const hasData = totals.total_scans > 0;
  const hasTrends = trends.length > 1;

  // prepare chart data
  const scoreChartData = hasTrends ? {
    labels: trends.map(t => formatPeriodLabel(t.period)),
    datasets: [{ data: trends.map(t => Number(t.avg_score) || 0) }],
  } : null;

  const scansChartData = hasTrends ? {
    labels: trends.map(t => formatPeriodLabel(t.period)),
    datasets: [{ data: trends.map(t => t.scan_count || 0) }],
  } : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Impact</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !hasData ? (
        <View style={styles.center}>
          <Ionicons name="analytics-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptyText}>
            Start scanning clothing labels to see your sustainability impact over time.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Ionicons name="scan-outline" size={22} color={colors.primary} />
              <Text style={styles.summaryValue}>{totals.total_scans}</Text>
              <Text style={styles.summaryLabel}>Total Scans</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="speedometer-outline" size={22} color={colors.primary} />
              <Text style={styles.summaryValue}>{totals.avg_score || 0}</Text>
              <Text style={styles.summaryLabel}>Avg Score</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="water-outline" size={22} color="#3B82F6" />
              <Text style={styles.summaryValue}>{Number(totals.total_water) >= 1000 ? `${(Number(totals.total_water) / 1000).toFixed(1)}k` : totals.total_water}</Text>
              <Text style={styles.summaryLabel}>Litres Water</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="cloud-outline" size={22} color="#F59E0B" />
              <Text style={styles.summaryValue}>{Number(totals.total_carbon).toFixed(1)}</Text>
              <Text style={styles.summaryLabel}>kg CO2</Text>
            </View>
          </View>

          {/* Period Toggle */}
          <View style={styles.periodToggle}>
            <TouchableOpacity
              style={[styles.periodBtn, period === 'week' && styles.periodBtnActive]}
              onPress={() => setPeriod('week')}
              accessibilityRole="tab"
              accessibilityLabel="Weekly view"
              accessibilityState={{ selected: period === 'week' }}
            >
              <Text style={[styles.periodText, period === 'week' && styles.periodTextActive]}>Weekly</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.periodBtn, period === 'month' && styles.periodBtnActive]}
              onPress={() => setPeriod('month')}
              accessibilityRole="tab"
              accessibilityLabel="Monthly view"
              accessibilityState={{ selected: period === 'month' }}
            >
              <Text style={[styles.periodText, period === 'month' && styles.periodTextActive]}>Monthly</Text>
            </TouchableOpacity>
          </View>

          {/* Score Trend Chart */}
          {hasTrends && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Sustainability Score Trend</Text>
              <Text style={styles.chartSubtitle}>Average environmental score per {period}</Text>
              <LineChart
                data={scoreChartData}
                width={CHART_WIDTH - spacing.md * 2}
                height={200}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withInnerLines={false}
                withOuterLines={false}
                yAxisSuffix=""
                fromZero
              />
            </View>
          )}

          {/* Scans Per Period Chart */}
          {hasTrends && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Scans Over Time</Text>
              <Text style={styles.chartSubtitle}>Number of garments scanned per {period}</Text>
              <BarChart
                data={scansChartData}
                width={CHART_WIDTH - spacing.md * 2}
                height={200}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(0, 201, 106, ${opacity})`,
                }}
                style={styles.chart}
                withInnerLines={false}
                fromZero
                showValuesOnTopOfBars
              />
            </View>
          )}

          {/* Grade Distribution */}
          {grades.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Grade Distribution</Text>
              <Text style={styles.chartSubtitle}>Breakdown of your scan grades</Text>
              <View style={styles.gradeGrid}>
                {['A', 'B', 'C', 'D', 'F'].map(grade => {
                  const entry = grades.find(g => g.grade === grade);
                  const count = entry ? entry.count : 0;
                  const total = totals.total_scans || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <View key={grade} style={styles.gradeItem}>
                      <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(grade) }]}>
                        <Text style={styles.gradeBadgeText}>{grade}</Text>
                      </View>
                      <View style={styles.gradeBarOuter}>
                        <View style={[styles.gradeBarInner, { width: `${Math.max(pct, 2)}%`, backgroundColor: getGradeColor(grade) }]} />
                      </View>
                      <Text style={styles.gradeCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Top Fibers */}
          {topFibers.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Most Scanned Fibers</Text>
              <Text style={styles.chartSubtitle}>Cumulative fiber percentages across all scans</Text>
              <View style={styles.fiberList}>
                {topFibers.map((fiber, i) => (
                  <View key={fiber.name} style={styles.fiberRow}>
                    <Text style={styles.fiberRank}>#{i + 1}</Text>
                    <Text style={styles.fiberName}>{fiber.name}</Text>
                    <Text style={styles.fiberTotal}>{fiber.total}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.lg,
  },
  // Summary cards
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    width: (CHART_WIDTH - spacing.sm) / 2,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  summaryValue: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Period toggle
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  periodBtnActive: {
    backgroundColor: colors.primary,
  },
  periodText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  periodTextActive: {
    color: colors.background,
    fontWeight: '700',
  },
  // Chart cards
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  chartTitle: {
    ...typography.h3,
    marginBottom: 2,
  },
  chartSubtitle: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  chart: {
    borderRadius: borderRadius.sm,
    marginLeft: -spacing.sm,
  },
  // Grade distribution
  gradeGrid: {
    gap: spacing.sm,
  },
  gradeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gradeBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  gradeBarOuter: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  gradeBarInner: {
    height: '100%',
    borderRadius: 4,
  },
  gradeCount: {
    ...typography.body,
    fontWeight: '700',
    width: 30,
    textAlign: 'right',
  },
  // Fiber list
  fiberList: {
    gap: spacing.sm,
  },
  fiberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fiberRank: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '700',
    width: 24,
  },
  fiberName: {
    ...typography.body,
    flex: 1,
  },
  fiberTotal: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
  },
});

export default SustainabilityScreen;
