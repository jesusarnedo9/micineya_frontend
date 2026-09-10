import { useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { PanResponder, View, type StyleProp, type ViewStyle } from 'react-native';

interface HorizontalSwipeAreaProps {
  children: ReactNode;
  onSwipe?: () => void;
  protectedViewRef?: RefObject<View | null>;
  style?: StyleProp<ViewStyle>;
}

/** Only claims deliberate horizontal gestures started outside the native player. */
export function HorizontalSwipeArea({ children, onSwipe, protectedViewRef, style }: HorizontalSwipeAreaProps) {
  const latest = useRef({ onSwipe, protectedViewRef });
  latest.current = { onSwipe, protectedViewRef };
  const touch = useRef({ x: 0, y: 0, serial: 0, blocked: false, cancelled: false });

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: ({ nativeEvent: event }) => {
      if (event.touches.length !== 1) {
        touch.current.cancelled = true;
        return false;
      }
      const player = latest.current.protectedViewRef?.current;
      const serial = touch.current.serial + 1;
      touch.current = { x: event.pageX, y: event.pageY, serial, blocked: !!player, cancelled: false };
      if (player) {
        const { pageX, pageY } = event;
        // Re-measure on each touch: a recycled reel can have moved since its layout.
        // Until measurement completes, leave the gesture to the player.
        player.measureInWindow((x, y, width, height) => {
          if (touch.current.serial !== serial) return;
          touch.current.blocked = width <= 0 || height <= 0
            || (pageX >= x - 8 && pageX <= x + width + 8 && pageY >= y - 8 && pageY <= y + height + 8);
        });
      }
      return false;
    },
    onMoveShouldSetPanResponderCapture: ({ nativeEvent: event }) => {
      const dx = Math.abs(event.pageX - touch.current.x);
      const dy = Math.abs(event.pageY - touch.current.y);
      if (event.touches.length !== 1 || (dy > 12 && dy > dx)) touch.current.cancelled = true;
      return !!latest.current.onSwipe && !touch.current.blocked && !touch.current.cancelled
        && dx >= 28 && dx > dy * 1.6;
    },
    onPanResponderMove: ({ nativeEvent: event }) => {
      if (event.touches.length > 1) touch.current.cancelled = true;
    },
    onPanResponderRelease: ({ nativeEvent: event }) => {
      const dx = Math.abs(event.pageX - touch.current.x);
      const dy = Math.abs(event.pageY - touch.current.y);
      if (!touch.current.blocked && !touch.current.cancelled && dx >= 72 && dx > dy * 1.6) {
        latest.current.onSwipe?.();
      }
      touch.current.cancelled = true;
    },
    onPanResponderTerminationRequest: () => true,
    onPanResponderTerminate: () => { touch.current.cancelled = true; },
  }), []);

  return <View style={style} {...(onSwipe ? responder.panHandlers : {})}>{children}</View>;
}
