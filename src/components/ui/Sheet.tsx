import React, { useEffect, useState } from 'react';
import { Modal, ModalProps, SafeAreaView, View } from 'react-native';
import { useThemeTokens } from '../../theme/useThemeTokens';

/** Roughly the length of RN's slide transition; content is held this long after dismissal. */
const DISMISS_MS = 400;

export type SheetProps = {
  visible: boolean;
  onRequestClose?: () => void;
  children: React.ReactNode;
  presentation?: 'fullScreen' | 'pageSheet';
  animationType?: ModalProps['animationType'];
};

/**
 * Modal shell with the mounting fix from ticket 02 baked in.
 *
 * React Native renders Modal children even while `visible={false}`. Any modal held in a
 * permanently-mounted tree therefore re-renders its entire body on every parent render, invisibly
 * — which is how a minimized workout ended up re-rendering the whole logger once per second.
 *
 * Gating on a delayed flag rather than `visible` directly keeps the content mounted through the
 * dismiss animation, so the sheet does not blank mid-slide-out. Use this instead of Modal.
 */
export const Sheet = React.memo(function Sheet({
  visible,
  onRequestClose,
  children,
  presentation = 'fullScreen',
  animationType = 'slide',
}: SheetProps) {
  const t = useThemeTokens();
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const timeout = setTimeout(() => setMounted(false), DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType={animationType}
      presentationStyle={presentation}
      onRequestClose={onRequestClose}
    >
      {mounted && (
        <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }}>
          <View style={{ flex: 1 }}>{children}</View>
        </SafeAreaView>
      )}
    </Modal>
  );
});
