import { useCallback, useState } from 'react';
import type { GestureResponderEvent, PressableProps } from 'react-native';

/**
 * Press-state tracking for the Pressable-based primitives.
 *
 * `Pressable` natively accepts `style={({ pressed }) => …}`, but this app must not use that form:
 * NativeWind registers Pressable for style interop (`cssInterop(Pressable, { className: 'style' })`
 * in react-native-css-interop), so its JSX runtime — enabled globally by the `jsxImportSource`
 * setting in babel.config.js — owns the `style` prop and merges objects and arrays only. A function
 * is not merged and not called; the whole container style is silently dropped, and the button
 * renders as bare unstyled text.
 *
 * Tracking `pressed` in state instead lets the primitives pass a plain array, which NativeWind does
 * honour, without giving up press feedback. Any caller-supplied handlers still fire.
 */
export function usePressed(
  onPressIn?: PressableProps['onPressIn'],
  onPressOut?: PressableProps['onPressOut']
) {
  const [pressed, setPressed] = useState(false);

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      setPressed(true);
      onPressIn?.(event);
    },
    [onPressIn]
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      setPressed(false);
      onPressOut?.(event);
    },
    [onPressOut]
  );

  return { pressed, onPressIn: handlePressIn, onPressOut: handlePressOut };
}
