// author: caitriona mccann
// date: 11/12/2025
// sVG components for ISO 3758 care label symbols

import React from 'react';
import Svg, { Path, Circle, Line, Rect, G, Text as SvgText } from 'react-native-svg';

const CareIcon = ({ name, size = 32, color = '#000' }) => {
  const icons = {
    // washing symbols
    'wash-hand': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M20,30 Q20,20 30,20 L70,20 Q80,20 80,30 L80,70 Q80,80 70,80 L30,80 Q20,80 20,70 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
        <Path d="M30,15 L35,10 L40,12 L38,15 M40,12 L45,10 L48,12 L46,15 M48,12 L53,10 L56,15" 
              stroke={color} strokeWidth="2" fill="none"/>
      </Svg>
    ),
    'wash-machine': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M20,30 Q20,20 30,20 L70,20 Q80,20 80,30 L80,70 Q80,80 70,80 L30,80 Q20,80 20,70 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
      </Svg>
    ),
    'wash-30': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M20,30 Q20,20 30,20 L70,20 Q80,20 80,30 L80,70 Q80,80 70,80 L30,80 Q20,80 20,70 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
        <SvgText x="50" y="58" fontSize="24" fill={color} textAnchor="middle" fontWeight="bold">30</SvgText>
      </Svg>
    ),
    'wash-40': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M20,30 Q20,20 30,20 L70,20 Q80,20 80,30 L80,70 Q80,80 70,80 L30,80 Q20,80 20,70 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
        <SvgText x="50" y="58" fontSize="24" fill={color} textAnchor="middle" fontWeight="bold">40</SvgText>
      </Svg>
    ),
    'wash-50': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M20,30 Q20,20 30,20 L70,20 Q80,20 80,30 L80,70 Q80,80 70,80 L30,80 Q20,80 20,70 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
        <SvgText x="50" y="58" fontSize="24" fill={color} textAnchor="middle" fontWeight="bold">50</SvgText>
      </Svg>
    ),
    'wash-60': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M20,30 Q20,20 30,20 L70,20 Q80,20 80,30 L80,70 Q80,80 70,80 L30,80 Q20,80 20,70 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
        <SvgText x="50" y="58" fontSize="24" fill={color} textAnchor="middle" fontWeight="bold">60</SvgText>
      </Svg>
    ),
    'wash-70': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M20,30 Q20,20 30,20 L70,20 Q80,20 80,30 L80,70 Q80,80 70,80 L30,80 Q20,80 20,70 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
        <SvgText x="50" y="58" fontSize="24" fill={color} textAnchor="middle" fontWeight="bold">70</SvgText>
      </Svg>
    ),
    'wash-95': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M20,30 Q20,20 30,20 L70,20 Q80,20 80,30 L80,70 Q80,80 70,80 L30,80 Q20,80 20,70 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
        <SvgText x="50" y="58" fontSize="24" fill={color} textAnchor="middle" fontWeight="bold">95</SvgText>
      </Svg>
    ),
    'wash-permanent-press': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M20,30 Q20,20 30,20 L70,20 Q80,20 80,30 L80,70 Q80,80 70,80 L30,80 Q20,80 20,70 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="20" y1="75" x2="80" y2="75" stroke={color} strokeWidth="2"/>
      </Svg>
    ),
    'wash-delicate': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M20,30 Q20,20 30,20 L70,20 Q80,20 80,30 L80,70 Q80,80 70,80 L30,80 Q20,80 20,70 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="20" y1="70" x2="80" y2="70" stroke={color} strokeWidth="2"/>
        <Line x1="20" y1="75" x2="80" y2="75" stroke={color} strokeWidth="2"/>
      </Svg>
    ),
    'wash-no': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M20,30 Q20,20 30,20 L70,20 Q80,20 80,30 L80,70 Q80,80 70,80 L30,80 Q20,80 20,70 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="15" y1="15" x2="85" y2="85" stroke={color} strokeWidth="3"/>
        <Line x1="85" y1="15" x2="15" y2="85" stroke={color} strokeWidth="3"/>
      </Svg>
    ),

    // bleaching symbols
    'bleach': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M50,20 L80,70 L20,70 Z" stroke={color} strokeWidth="3" fill="none"/>
      </Svg>
    ),
    'bleach-non-chlorine': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M50,20 L80,70 L20,70 Z" stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="35" y1="55" x2="65" y2="55" stroke={color} strokeWidth="2"/>
        <Line x1="40" y1="45" x2="60" y2="45" stroke={color} strokeWidth="2"/>
      </Svg>
    ),
    'bleach-no': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M50,20 L80,70 L20,70 Z" stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="20" y1="20" x2="80" y2="80" stroke={color} strokeWidth="3"/>
        <Line x1="80" y1="20" x2="20" y2="80" stroke={color} strokeWidth="3"/>
      </Svg>
    ),

    // ironing symbols
    'iron': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M30,50 L30,35 Q30,25 40,25 L75,25 Q82,25 85,30 L85,50 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
      </Svg>
    ),
    'iron-low': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M30,50 L30,35 Q30,25 40,25 L75,25 Q82,25 85,30 L85,50 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
        <Circle cx="57" cy="38" r="2.5" fill={color}/>
      </Svg>
    ),
    'iron-medium': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M30,50 L30,35 Q30,25 40,25 L75,25 Q82,25 85,30 L85,50 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
        <Circle cx="52" cy="38" r="2.5" fill={color}/>
        <Circle cx="62" cy="38" r="2.5" fill={color}/>
      </Svg>
    ),
    'iron-high': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M30,50 L30,35 Q30,25 40,25 L75,25 Q82,25 85,30 L85,50 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
        <Circle cx="47" cy="38" r="2.5" fill={color}/>
        <Circle cx="57" cy="38" r="2.5" fill={color}/>
        <Circle cx="67" cy="38" r="2.5" fill={color}/>
      </Svg>
    ),
    'iron-no': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M30,50 L30,35 Q30,25 40,25 L75,25 Q82,25 85,30 L85,50 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="25" y1="20" x2="90" y2="55" stroke={color} strokeWidth="3"/>
        <Line x1="90" y1="20" x2="25" y2="55" stroke={color} strokeWidth="3"/>
      </Svg>
    ),
    'iron-no-steam': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M30,50 L30,35 Q30,25 40,25 L75,25 Q82,25 85,30 L85,50 Z" 
              stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="40" y1="60" x2="40" y2="75" stroke={color} strokeWidth="2"/>
        <Line x1="50" y1="60" x2="50" y2="75" stroke={color} strokeWidth="2"/>
        <Line x1="60" y1="60" x2="60" y2="75" stroke={color} strokeWidth="2"/>
        <Line x1="30" y1="55" x2="70" y2="80" stroke={color} strokeWidth="3"/>
      </Svg>
    ),

    // dry cleaning symbols
    'dryclean': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="30" stroke={color} strokeWidth="3" fill="none"/>
      </Svg>
    ),
    'dryclean-p': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="30" stroke={color} strokeWidth="3" fill="none"/>
        <SvgText x="50" y="62" fontSize="32" fill={color} textAnchor="middle" fontWeight="bold">P</SvgText>
      </Svg>
    ),
    'dryclean-f': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="30" stroke={color} strokeWidth="3" fill="none"/>
        <SvgText x="50" y="62" fontSize="32" fill={color} textAnchor="middle" fontWeight="bold">F</SvgText>
      </Svg>
    ),
    'dryclean-a': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="30" stroke={color} strokeWidth="3" fill="none"/>
        <SvgText x="50" y="62" fontSize="32" fill={color} textAnchor="middle" fontWeight="bold">A</SvgText>
      </Svg>
    ),
    'dryclean-w': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="30" stroke={color} strokeWidth="3" fill="none"/>
        <SvgText x="50" y="62" fontSize="32" fill={color} textAnchor="middle" fontWeight="bold">W</SvgText>
      </Svg>
    ),
    'dryclean-no': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="30" stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="25" y1="25" x2="75" y2="75" stroke={color} strokeWidth="3"/>
        <Line x1="75" y1="25" x2="25" y2="75" stroke={color} strokeWidth="3"/>
      </Svg>
    ),
    'wetclean-w': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="30" stroke={color} strokeWidth="3" fill="none"/>
        <SvgText x="50" y="62" fontSize="32" fill={color} textAnchor="middle" fontWeight="bold">W</SvgText>
      </Svg>
    ),
    'wetclean-no': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="30" stroke={color} strokeWidth="3" fill="none"/>
        <SvgText x="50" y="62" fontSize="32" fill={color} textAnchor="middle" fontWeight="bold">W</SvgText>
        <Line x1="25" y1="25" x2="75" y2="75" stroke={color} strokeWidth="3"/>
        <Line x1="75" y1="25" x2="25" y2="75" stroke={color} strokeWidth="3"/>
      </Svg>
    ),

    // tumble dry symbols
    'tumble-dry': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x="20" y="20" width="60" height="60" stroke={color} strokeWidth="3" fill="none"/>
        <Circle cx="50" cy="50" r="20" stroke={color} strokeWidth="3" fill="none"/>
      </Svg>
    ),
    'tumble-dry-low': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x="20" y="20" width="60" height="60" stroke={color} strokeWidth="3" fill="none"/>
        <Circle cx="50" cy="50" r="20" stroke={color} strokeWidth="3" fill="none"/>
        <Circle cx="50" cy="50" r="2.5" fill={color}/>
      </Svg>
    ),
    'tumble-dry-medium': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x="20" y="20" width="60" height="60" stroke={color} strokeWidth="3" fill="none"/>
        <Circle cx="50" cy="50" r="20" stroke={color} strokeWidth="3" fill="none"/>
        <Circle cx="45" cy="50" r="2.5" fill={color}/>
        <Circle cx="55" cy="50" r="2.5" fill={color}/>
      </Svg>
    ),
    'tumble-dry-high': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x="20" y="20" width="60" height="60" stroke={color} strokeWidth="3" fill="none"/>
        <Circle cx="50" cy="50" r="20" stroke={color} strokeWidth="3" fill="none"/>
        <Circle cx="42" cy="50" r="2.5" fill={color}/>
        <Circle cx="50" cy="50" r="2.5" fill={color}/>
        <Circle cx="58" cy="50" r="2.5" fill={color}/>
      </Svg>
    ),
    'tumble-dry-no': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x="20" y="20" width="60" height="60" stroke={color} strokeWidth="3" fill="none"/>
        <Circle cx="50" cy="50" r="20" stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="15" y1="15" x2="85" y2="85" stroke={color} strokeWidth="3"/>
        <Line x1="85" y1="15" x2="15" y2="85" stroke={color} strokeWidth="3"/>
      </Svg>
    ),
    'tumble-dry-no-heat': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x="20" y="20" width="60" height="60" stroke={color} strokeWidth="3" fill="none"/>
        <Circle cx="50" cy="50" r="20" stroke={color} strokeWidth="3" fill="none"/>
        <Circle cx="50" cy="50" r="8" stroke={color} strokeWidth="2" fill="none"/>
      </Svg>
    ),

    // drying symbols
    'dry-flat': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x="15" y="15" width="70" height="70" stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="20" y1="50" x2="80" y2="50" stroke={color} strokeWidth="3"/>
      </Svg>
    ),
    'dry-line': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x="15" y="15" width="70" height="70" stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="50" y1="20" x2="50" y2="80" stroke={color} strokeWidth="3"/>
      </Svg>
    ),
    'dry-drip': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x="15" y="15" width="70" height="70" stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="50" y1="20" x2="50" y2="55" stroke={color} strokeWidth="3"/>
        <Line x1="40" y1="60" x2="40" y2="75" stroke={color} strokeWidth="2"/>
        <Line x1="50" y1="60" x2="50" y2="75" stroke={color} strokeWidth="2"/>
        <Line x1="60" y1="60" x2="60" y2="75" stroke={color} strokeWidth="2"/>
      </Svg>
    ),
    'dry-shade': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x="15" y="15" width="70" height="70" stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="20" y1="20" x2="50" y2="50" stroke={color} strokeWidth="2"/>
        <Line x1="30" y1="20" x2="60" y2="50" stroke={color} strokeWidth="2"/>
        <Line x1="40" y1="20" x2="70" y2="50" stroke={color} strokeWidth="2"/>
        <Line x1="50" y1="20" x2="80" y2="50" stroke={color} strokeWidth="2"/>
      </Svg>
    ),
    'dry-shade-flat': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x="15" y="15" width="70" height="70" stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="20" y1="50" x2="80" y2="50" stroke={color} strokeWidth="3"/>
        <Line x1="20" y1="20" x2="50" y2="45" stroke={color} strokeWidth="2"/>
        <Line x1="30" y1="20" x2="60" y2="45" stroke={color} strokeWidth="2"/>
        <Line x1="40" y1="20" x2="70" y2="45" stroke={color} strokeWidth="2"/>
      </Svg>
    ),
    'dry-shade-line': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x="15" y="15" width="70" height="70" stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="50" y1="20" x2="50" y2="80" stroke={color} strokeWidth="3"/>
        <Line x1="20" y1="20" x2="45" y2="40" stroke={color} strokeWidth="2"/>
        <Line x1="25" y1="20" x2="50" y2="40" stroke={color} strokeWidth="2"/>
        <Line x1="30" y1="20" x2="55" y2="40" stroke={color} strokeWidth="2"/>
      </Svg>
    ),
    'dry-no': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x="15" y="15" width="70" height="70" stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="10" y1="10" x2="90" y2="90" stroke={color} strokeWidth="3"/>
        <Line x1="90" y1="10" x2="10" y2="90" stroke={color} strokeWidth="3"/>
      </Svg>
    ),

    // wringing symbols
    'wring-no': () => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M20,30 Q30,20 40,30 Q50,40 60,30 Q70,20 80,30" 
              stroke={color} strokeWidth="3" fill="none"/>
        <Line x1="15" y1="15" x2="85" y2="85" stroke={color} strokeWidth="3"/>
        <Line x1="85" y1="15" x2="15" y2="85" stroke={color} strokeWidth="3"/>
      </Svg>
    ),
  };

  const IconComponent = icons[name];
  return IconComponent ? <IconComponent /> : null;
};

export default CareIcon;
