import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export interface TeslaBatteryMeterProps {
  current: number;
  target: number;
  unit?: string | null;
  isComplete?: boolean;
}

/**
 * Indicador segmentado estilo batería de vehículo Tesla (100% nativo, 120 FPS).
 */
export const TeslaBatteryMeter: React.FC<TeslaBatteryMeterProps> = ({
  current,
  target,
  unit,
  isComplete = false,
}) => {
  const { theme } = useTheme();
  const safeTarget = Math.max(1, target);
  const ratio = Math.min(1, Math.max(0, current / safeTarget));
  const percent = Math.round(ratio * 100);
  const segmentCount = safeTarget <= 10 ? safeTarget : 10;
  const exactFilledUnits = ratio * segmentCount;

  return (
    <View style={styles.wrapper}>
      <View style={styles.batteryShell}>
        <View style={styles.cellsRow}>
          {Array.from({ length: segmentCount }).map((_, idx) => {
            const cellFill = Math.max(0, Math.min(1, exactFilledUnits - idx));
            const isFull = cellFill >= 0.99;
            const isPartial = cellFill > 0.02 && cellFill < 0.99;

            return (
              <View
                key={idx}
                style={[
                  styles.cellTrack,
                  {
                    backgroundColor: theme.pillBg,
                    borderColor: isFull
                      ? theme.accentPrimary
                      : theme.glassBorder,
                  },
                ]}
              >
                {isFull ? (
                  <View
                    style={[
                      styles.cellFillFull,
                      { backgroundColor: theme.accentPrimary },
                    ]}
                  />
                ) : isPartial ? (
                  <View
                    style={[
                      styles.cellFillFull,
                      {
                        width: `${Math.round(cellFill * 100)}%`,
                        backgroundColor: theme.accentPrimary,
                        opacity: 0.75,
                      },
                    ]}
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Borne terminal estilo batería EV */}
        <View
          style={[
            styles.terminalCap,
            {
              backgroundColor: isComplete
                ? theme.accentPrimary
                : theme.glassBorderStrong,
            },
          ]}
        />
      </View>

      <Text
        style={[
          styles.readoutText,
          {
            color: isComplete ? theme.accentPrimaryLink : theme.textSecondary,
          },
        ]}
      >
        {current} / {safeTarget} {unit || 'veces'} · {percent}%
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: 5,
    marginTop: 2,
  },
  batteryShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cellsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cellTrack: {
    flex: 1,
    height: 7,
    borderRadius: 3,
    borderWidth: 0.75,
    overflow: 'hidden',
  },
  cellFillFull: {
    width: '100%',
    height: '100%',
  },
  terminalCap: {
    width: 2.5,
    height: 8,
    borderRadius: 1.5,
  },
  readoutText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});

export default TeslaBatteryMeter;
