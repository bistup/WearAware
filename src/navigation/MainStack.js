// author: caitriona mccann
// date: 26/11/2025
// navigation for the actual app - home screen, camera, results, history, all that
// once you're logged in this is what controls where you can go

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/main/HomeScreen';
import CameraScreen from '../screens/main/CameraScreen';
import ScanResultScreen from '../screens/main/ScanResultScreen';
import BreakdownScreen from '../screens/main/BreakdownScreen';
import EditScanScreen from '../screens/main/EditScanScreen';
import ManualInputScreen from '../screens/main/ManualInputScreen';
import HistoryScreen from '../screens/main/HistoryScreen';
import ProfileScreen from '../screens/auth/ProfileScreen';

const Stack = createNativeStackNavigator();

const MainStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Camera" component={CameraScreen} />
      <Stack.Screen name="ScanResult" component={ScanResultScreen} />
      <Stack.Screen name="Breakdown" component={BreakdownScreen} />
      <Stack.Screen name="EditScan" component={EditScanScreen} />
      <Stack.Screen name="ManualInput" component={ManualInputScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
};

export default MainStack;


