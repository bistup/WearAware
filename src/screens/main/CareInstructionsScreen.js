// author: caitriona mccann
// date: 11/12/2025
// displays care instructions detected from care label symbols

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Card from '../../components/Card';
import Button from '../../components/Button';
import CareIcon from '../../components/CareIcon';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';

const CareInstructionsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { careInstructions = [], rawText = '' } = route.params || {};

  const groupedInstructions = {
    wash: careInstructions.filter(i => i.type === 'wash'),
    bleach: careInstructions.filter(i => i.type === 'bleach'),
    dry: careInstructions.filter(i => i.type === 'dry'),
    iron: careInstructions.filter(i => i.type === 'iron'),
    dryclean: careInstructions.filter(i => i.type === 'dryclean'),
    color: careInstructions.filter(i => i.type === 'color'),
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Care Instructions</Text>
        <Text style={styles.subtitle}>
          Follow these guidelines to keep your garment in great condition
        </Text>

        {groupedInstructions.wash.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Washing</Text>
            {groupedInstructions.wash.map((instruction, index) => (
              <View key={index} style={styles.instructionRow}>
                <Text style={styles.icon}>{instruction.icon}</Text>
                <View style={styles.instructionContent}>
                  <Text style={styles.instructionText}>{instruction.instruction}</Text>
                  {instruction.symbol && (
                    <Text style={styles.symbolHint}>Symbol: {instruction.symbol}</Text>
                  )}
                </View>
              </View>
            ))}
          </Card>
        )}

        {groupedInstructions.bleach.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Bleaching</Text>
            {groupedInstructions.bleach.map((instruction, index) => (
              <View key={index} style={styles.instructionRow}>
                <View style={styles.iconContainer}>
                  <CareIcon name={instruction.iconName} size={40} color={colors.text} />
                </View>
                <View style={styles.instructionContent}>
                  <Text style={styles.instructionText}>{instruction.instruction}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {groupedInstructions.dry.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Drying</Text>
            {groupedInstructions.dry.map((instruction, index) => (
              <View key={index} style={styles.instructionRow}>
                <View style={styles.iconContainer}>
                  <CareIcon name={instruction.iconName} size={40} color={colors.text} />
                </View>
                <View style={styles.instructionContent}>
                  <Text style={styles.instructionText}>{instruction.instruction}</Text>
                  {instruction.temperature && (
                    <Text style={styles.tempHint}>Temperature: {instruction.temperature}°C</Text>
                  )}
                </View>
              </View>
            ))}
          </Card>
        )}

        {groupedInstructions.iron.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Ironing</Text>
            {groupedInstructions.iron.map((instruction, index) => (
              <View key={index} style={styles.instructionRow}>
                <View style={styles.iconContainer}>
                  <CareIcon name={instruction.iconName} size={40} color={colors.text} />
                </View>
                <View style={styles.instructionContent}>
                  <Text style={styles.instructionText}>{instruction.instruction}</Text>
                  {instruction.temperature && (
                    <Text style={styles.tempHint}>Temperature: {instruction.temperature}°C</Text>
                  )}
                </View>
              </View>
            ))}
          </Card>
        )}

        {groupedInstructions.dryclean.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Dry Cleaning</Text>
            {groupedInstructions.dryclean.map((instruction, index) => (
              <View key={index} style={styles.instructionRow}>
                <View style={styles.iconContainer}>
                  <CareIcon name={instruction.iconName} size={40} color={colors.text} />
                </View>
                <View style={styles.instructionContent}>
                  <Text style={styles.instructionText}>{instruction.instruction}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {groupedInstructions.color.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Color Care</Text>
            {groupedInstructions.color.map((instruction, index) => (
              <View key={index} style={styles.instructionRow}>
                {instruction.iconName ? (
                  <View style={styles.iconContainer}>
                    <CareIcon name={instruction.iconName} size={40} color={colors.text} />
                  </View>
                ) : (
                  <View style={styles.iconContainer}>
                    <Text style={styles.iconPlaceholder}>•</Text>
                  </View>
                )}
                <Text style={styles.instructionText}>{instruction.instruction}</Text>
              </View>
            ))}
          </Card>
        )}

        {careInstructions.length === 0 && (
          <Card style={styles.card}>
            <Text style={styles.emptyText}>No care instructions detected</Text>
          </Card>
        )}

        <Button
          title="Scan Another Label"
          onPress={() => navigation.navigate('Camera')}
          style={styles.actionButton}
        />

        <Button
          title="Done"
          onPress={() => navigation.navigate('Home')}
          variant="secondary"
          style={styles.actionButton}
        />
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
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  card: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconContainer: {
    marginRight: spacing.md,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlaceholder: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  instructionContent: {
    flex: 1,
  },
  instructionText: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  tempHint: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  symbolHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  actionButton: {
    marginBottom: spacing.md,
  },
});

export default CareInstructionsScreen;
