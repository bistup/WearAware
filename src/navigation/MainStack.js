// author: caitriona mccann
// date: 26/11/2025
// last updated: 10/02/2026
// main navigation stack - tab navigator at root with detail screens stacked on top
// persistent bottom tab bar via TabNavigator

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './TabNavigator';
import ScanResultScreen from '../screens/main/ScanResultScreen';
import BreakdownScreen from '../screens/main/BreakdownScreen';
import EditScanScreen from '../screens/main/EditScanScreen';
import ManualInputScreen from '../screens/main/ManualInputScreen';
import CareInstructionsScreen from '../screens/main/CareInstructionsScreen';
import ComparisonScreen from '../screens/main/ComparisonScreen';

// social screens
import CommentsScreen from '../screens/main/CommentsScreen';
import SocialProfileScreen from '../screens/main/SocialProfileScreen';
import FollowerListScreen from '../screens/main/FollowerListScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';

// alternatives & wishlist
import AlternativesScreen from '../screens/main/AlternativesScreen';
import WishlistScreen from '../screens/main/WishlistScreen';

// gamification
import LeaderboardScreen from '../screens/main/LeaderboardScreen';
import ChallengesScreen from '../screens/main/ChallengesScreen';

// charity shops
import CharityShopsScreen from '../screens/main/CharityShopsScreen';

// wardrobe & outfits
import WardrobeScreen from '../screens/main/WardrobeScreen';
import OutfitsScreen from '../screens/main/OutfitsScreen';

// marketplace
import MarketplaceScreen from '../screens/main/MarketplaceScreen';

// sustainability insights
import SustainabilityScreen from '../screens/main/SustainabilityScreen';

// messaging & trades
import MessagesScreen from '../screens/main/MessagesScreen';
import ChatScreen from '../screens/main/ChatScreen';
import TradeScreen from '../screens/main/TradeScreen';

// privacy & gdpr
import DataPrivacyScreen from '../screens/main/DataPrivacyScreen';

const Stack = createNativeStackNavigator();

const MainStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Tab navigator is the root - provides persistent bottom bar */}
      <Stack.Screen name="Tabs" component={TabNavigator} />

      {/* Detail screens stack on top of tabs */}
      <Stack.Screen name="ScanResult" component={ScanResultScreen} />
      <Stack.Screen name="CareInstructions" component={CareInstructionsScreen} />
      <Stack.Screen name="Breakdown" component={BreakdownScreen} />
      <Stack.Screen name="EditScan" component={EditScanScreen} />
      <Stack.Screen name="ManualInput" component={ManualInputScreen} />
      <Stack.Screen name="Comparison" component={ComparisonScreen} />

      {/* Social */}
      <Stack.Screen name="Comments" component={CommentsScreen} />
      <Stack.Screen name="SocialProfile" component={SocialProfileScreen} />
      <Stack.Screen name="FollowerList" component={FollowerListScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />

      {/* Alternatives */}
      <Stack.Screen name="Alternatives" component={AlternativesScreen} />
      <Stack.Screen name="Wishlist" component={WishlistScreen} />

      {/* Gamification */}
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Stack.Screen name="Challenges" component={ChallengesScreen} />

      {/* Charity Shops */}
      <Stack.Screen name="CharityShops" component={CharityShopsScreen} />

      {/* Wardrobe & Outfits */}
      <Stack.Screen name="Wardrobe" component={WardrobeScreen} />
      <Stack.Screen name="Outfits" component={OutfitsScreen} />

      {/* Marketplace */}
      <Stack.Screen name="MarketplaceScreen" component={MarketplaceScreen} />

      {/* Sustainability Insights */}
      <Stack.Screen name="Sustainability" component={SustainabilityScreen} />

      {/* Messaging & Trades */}
      <Stack.Screen name="Messages" component={MessagesScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Trade" component={TradeScreen} />

      {/* Privacy & GDPR */}
      <Stack.Screen name="DataPrivacy" component={DataPrivacyScreen} />
    </Stack.Navigator>
  );
};

export default MainStack;


