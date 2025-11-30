// author: caitriona mccann
// date: 27/11/2025
// detailed breakdown showing environmental impact for each fiber in the garment
// shows ireland context for water usage

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Card from '../../components/Card';
import GradeIndicator from '../../components/GradeIndicator';
import { colors, typography, spacing } from '../../theme/theme';
import { getFiberImpact } from '../../utils/impactCalculator';

const BreakdownScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { scanData } = route.params || {};
  const { 
    fibers = [], 
    grade = 'C', 
    water_usage_liters,
    carbon_footprint_kg,
    item_weight_grams,
  } = scanData || {};

  const ImpactMetric = ({ label, value, unit }) => (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {value} <Text style={styles.metricUnit}>{unit}</Text>
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Environmental Breakdown</Text>

        <Card style={styles.gradeCard}>
          <View style={styles.gradeHeader}>
            <GradeIndicator grade={grade} size="small" />
            <Text style={styles.gradeTitle}>Overall Grade: {grade}</Text>
          </View>
        </Card>

        {(water_usage_liters || carbon_footprint_kg) && (
          <Card style={styles.impactCard}>
            <Text style={styles.sectionTitle}>Total Environmental Impact</Text>
            {item_weight_grams && (
              <ImpactMetric
                label="Garment Weight"
                value={item_weight_grams}
                unit="g"
              />
            )}
            {water_usage_liters != null && (
              <ImpactMetric
                label="Water Footprint"
                value={typeof water_usage_liters === 'number' ? water_usage_liters.toFixed(1) : water_usage_liters}
                unit="litres"
              />
            )}
            {carbon_footprint_kg != null && (
              <ImpactMetric
                label="Carbon Footprint"
                value={typeof carbon_footprint_kg === 'number' ? carbon_footprint_kg.toFixed(2) : carbon_footprint_kg}
                unit="kg CO₂"
              />
            )}
            <View style={styles.comparisonBox}>
              <Text style={styles.comparisonText}>
                💧 {water_usage_liters != null && typeof water_usage_liters === 'number' ? 
                  `Equivalent to ${Math.round(water_usage_liters / 8)} cups of tea` : 
                  'Water usage varies by fiber'}
              </Text>
              <Text style={styles.comparisonText}>
                🌍 {carbon_footprint_kg != null && typeof carbon_footprint_kg === 'number' ? 
                  `Equal to driving ${(carbon_footprint_kg * 4.5).toFixed(1)}km in a petrol car` : 
                  'Carbon varies by production'}
              </Text>
            </View>
          </Card>
        )}

        <Card>
          <Text style={styles.sectionTitle}>Fiber Contribution to This Garment</Text>
          {fibers.map((fiber, index) => {
            const impact = getFiberImpact(fiber.name);
            const weightKg = (item_weight_grams || 0) / 1000;
            const fiberPercentage = fiber.percentage / 100;
            
            // calculate how much each fiber contributes to total impact
            const fiberWaterUsage = impact.waterUsage * weightKg * fiberPercentage;
            const fiberCarbonFootprint = impact.co2 * weightKg * fiberPercentage;
            
            return (
              <View key={index} style={styles.fiberSection}>
                <View style={styles.fiberHeader}>
                  <Text style={styles.fiberName}>
                    {fiber.name} ({fiber.percentage}%)
                  </Text>
                  <GradeIndicator grade={impact.grade} size="small" />
                </View>
                <ImpactMetric
                  label="Water Used"
                  value={fiberWaterUsage.toFixed(1)}
                  unit="litres"
                />
                <ImpactMetric 
                  label="CO₂ Emissions" 
                  value={fiberCarbonFootprint.toFixed(3)} 
                  unit="kg CO₂e" 
                />
                <ImpactMetric
                  label="Biodegradable"
                  value={impact.biodegradable ? 'Yes' : 'No'}
                  unit=""
                />
                <ImpactMetric
                  label="Time to Biodegrade"
                  value={impact.biodegradabilityTime || 'Unknown'}
                  unit=""
                />
                <View style={styles.fiberRate}>
                  <Text style={styles.fiberRateText}>
                    Rate: {impact.waterUsage.toLocaleString()}L/kg, {impact.co2}kg CO₂e/kg
                  </Text>
                </View>
              </View>
            );
          })}
        </Card>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Sustainability Tips</Text>
          <Text style={styles.infoText}>
            • Wash in cold water (30°C) to save energy{'\n'}
            • Air dry instead of tumble drying{'\n'}
            • Repair and mend to extend garment life{'\n'}
            • Buy secondhand when possible{'\n'}
            • Donate or recycle responsibly at end of life{'\n'}
            • Choose natural fibers with lower water footprints
          </Text>
        </Card>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>🇮🇪 Ireland Context</Text>
          <Text style={styles.infoText}>
            The average Irish household uses about 320 litres of water per day. This garment's water footprint represents {water_usage_liters != null && typeof water_usage_liters === 'number' ? `${((water_usage_liters / 320) * 100).toFixed(1)}%` : 'a portion'} of daily household usage during production.
            {'\n\n'}
            Ireland's textile and fashion sector is growing its commitment to sustainability. Making conscious choices helps reduce our environmental impact.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.lg,
  },
  backText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.lg,
  },
  gradeCard: {
    marginBottom: spacing.md,
  },
  impactCard: {
    marginBottom: spacing.lg,
  },
  gradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gradeTitle: {
    ...typography.h3,
    marginLeft: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  fiberSection: {
    marginBottom: spacing.lg,
  },
  fiberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  fiberName: {
    ...typography.body,
    fontWeight: '600',
  },
  fiberRate: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  fiberRateText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontSize: 11,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  metricLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  metricValue: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  metricUnit: {
    fontWeight: '400',
    color: colors.textTertiary,
  },
  infoCard: {
    backgroundColor: colors.surfaceSecondary,
    marginTop: spacing.md,
  },
  infoTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  comparisonBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  comparisonText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
});

export default BreakdownScreen;


