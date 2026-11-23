import React, { useState } from 'react';
import { Image, ImageSourcePropType, LayoutChangeEvent, StyleProp, View, ViewStyle } from 'react-native';

/**
 * Photo that always fills a width:height frame and is centre-cropped (faces stay in view).
 *
 * The frame is measured (onLayout) and the picture is given EXACT pixel width/height, so its own
 * pixel size or any automatic sizing can never stretch, zoom or shift it. Before the first
 * measurement a neutral block of the right shape is shown (no layout jump).
 *
 * `focusY` moves the crop vertically (0 = top, 1 = bottom). Portraits/wide crops where faces sit
 * in the upper part use ~0.3.
 */
export const FitImage: React.FC<{
  source: ImageSourcePropType;
  ratio: number;
  radius?: number;
  focusY?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ source, ratio, radius = 0, focusY = 0.5, style }) => {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next !== w) setW(next);
  };
  const h = w ? Math.round(w / ratio) : 0;
  return (
    <View
      onLayout={onLayout}
      style={[{ width: '100%', aspectRatio: ratio, borderRadius: radius, overflow: 'hidden', backgroundColor: '#E2E8F0' }, style]}
    >
      {w > 0 ? (
        <Image
          source={source}
          resizeMode="cover"
          style={[{ width: w, height: h }, { objectPosition: `50% ${Math.round(focusY * 100)}%` } as any]}
        />
      ) : null}
    </View>
  );
};
