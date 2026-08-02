import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useUnits } from '../../context/UnitContext';
import { useWorkout } from '../../context/WorkoutContext';
import { supabase } from '../../lib/supabase';
import { BackgroundGlows } from '../../components/background-glows';
import { Button, Card, Screen, Text } from '../../components/ui';
import { useThemeTokens } from '../../theme/useThemeTokens';
import { AlertCircle, Calendar, Dumbbell } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const ITEMS_PER_PAGE = 10;

/** Height reserved when the floating "workout in progress" bar is showing, so it insets the
 *  list instead of covering it. The bar is absolutely positioned by ActiveWorkoutLogger. */
const IN_PROGRESS_BAR_SPACE = 96;

type WorkoutRow = {
  id: string;
  name: string;
  started_at: string;
  completed_at: string;
  notes: string | null;
  workout_exercises?: any[];
};

function workoutVolume(workout: WorkoutRow) {
  let volume = 0;
  workout.workout_exercises?.forEach((we: any) => {
    we.workout_sets?.forEach((set: any) => {
      if (set.is_completed) volume += (set.weight || 0) * (set.reps || 0);
    });
  });
  return volume;
}

const HistoryCard = React.memo(function HistoryCard({
  workout,
  formatWeight,
}: {
  workout: WorkoutRow;
  formatWeight: (n: number) => string;
}) {
  const t = useThemeTokens();
  const date = new Date(workout.completed_at);
  const durationMins = Math.max(
    0,
    Math.round(
      (new Date(workout.completed_at).getTime() - new Date(workout.started_at).getTime()) / 60000
    )
  );

  return (
    <Card style={{ marginBottom: t.spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text variant="heading" numberOfLines={1}>
            {workout.name}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.xs,
              marginTop: t.spacing.xs,
            }}
          >
            <Calendar size={14} color={t.color.textTertiary} />
            <Text variant="callout" color="textSecondary" tabular>
              {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {durationMins} min
            </Text>
          </View>
        </View>
        <View
          style={{
            backgroundColor: t.color.accentSoft,
            borderRadius: t.radius.pill,
            paddingHorizontal: t.spacing.md,
            paddingVertical: t.spacing.xs,
            alignSelf: 'flex-start',
          }}
        >
          <Text variant="label" color="accent" tabular>
            {formatWeight(workoutVolume(workout))}
          </Text>
        </View>
      </View>

      {workout.workout_exercises?.length ? (
        <View
          style={{
            marginTop: t.spacing.md,
            paddingTop: t.spacing.md,
            borderTopWidth: 1,
            borderTopColor: t.color.borderSoft,
            gap: t.spacing.sm,
          }}
        >
          {workout.workout_exercises.slice(0, 3).map((we: any, idx: number) => (
            <View
              key={we.id || idx}
              style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}
            >
              <Dumbbell size={14} color={t.color.accent} strokeWidth={2} />
              <Text variant="callout" color="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
                {we.exercises?.name || 'Exercise'}
              </Text>
              <Text variant="callout" color="textTertiary" tabular>
                {we.workout_sets?.filter((s: any) => s.is_completed).length} sets
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
});

export default function DashboardScreen() {
  const { profile, user } = useAuth();
  const { formatWeight, weightUnit } = useUnits();
  const { startWorkout, activeWorkout } = useWorkout();
  const t = useThemeTokens();

  const [history, setHistory] = useState<WorkoutRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchHistory = useCallback(
    async (reset = false) => {
      if (!user) return;
      try {
        const startPage = reset ? 0 : page;
        reset ? setLoadingHistory(true) : setLoadingMore(true);

        const from = startPage * ITEMS_PER_PAGE;
        const { data, error, count } = await supabase
          .from('workouts')
          .select(
            `id, name, started_at, completed_at, notes,
             workout_exercises (
               id, order_index,
               exercises (id, name, category),
               workout_sets (id, set_index, reps, weight, is_completed)
             )`,
            { count: 'exact' }
          )
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false })
          .range(from, from + ITEMS_PER_PAGE - 1);

        if (error) throw error;

        const rows = (data || []) as WorkoutRow[];
        setHistory((prev) => (reset ? rows : [...prev, ...rows]));
        setPage(reset ? 1 : startPage + 1);
        setHasMore(rows.length === ITEMS_PER_PAGE);
        if (count !== null) setTotalCount(count);
      } catch (e) {
        console.error('Error fetching workout history:', e);
      } finally {
        setLoadingHistory(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [user, page]
  );

  useEffect(() => {
    fetchHistory(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const quickStartScale = useSharedValue(1);
  const quickStartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: quickStartScale.value }],
  }));

  const lastVolume = useMemo(
    () => (history.length > 0 ? formatWeight(workoutVolume(history[0])) : `0 ${weightUnit}`),
    [history, formatWeight, weightUnit]
  );

  const onScroll = useCallback(
    (event: any) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const nearBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
      if (nearBottom && !loadingMore && hasMore && !loadingHistory) fetchHistory(false);
    },
    [loadingMore, hasMore, loadingHistory, fetchHistory]
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <BackgroundGlows />
      <Screen
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchHistory(true);
            }}
            tintColor={t.color.accent}
          />
        }
      >
        <View style={{ marginBottom: t.spacing.xl }}>
          <Text variant="callout" color="textSecondary">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <Text variant="title1" style={{ marginTop: t.spacing.xs }}>
            Welcome, {profile?.username || 'Friend'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: t.spacing.md, marginBottom: t.spacing.xl }}>
          <Pressable
            onPress={() => startWorkout('Blank Session')}
            onPressIn={() => {
              quickStartScale.value = withSpring(0.97);
            }}
            onPressOut={() => {
              quickStartScale.value = withSpring(1);
            }}
            style={{ flex: 1.2 }}
            accessibilityRole="button"
          >
            <Animated.View style={quickStartStyle}>
              <Card
                elevation="raised"
                style={{
                  height: 176,
                  justifyContent: 'space-between',
                  borderColor: t.color.accent,
                }}
              >
                <View>
                  <Text variant="heading">Quick start</Text>
                  <Text
                    variant="callout"
                    color="textSecondary"
                    style={{ marginTop: t.spacing.sm }}
                  >
                    Start a blank session and log your progress.
                  </Text>
                </View>
                <Text variant="bodyStrong" color="accent">
                  Start workout →
                </Text>
              </Card>
            </Animated.View>
          </Pressable>

          <View style={{ flex: 1, gap: t.spacing.md }}>
            <Card padding="md" style={{ flex: 1, justifyContent: 'center' }}>
              <Text variant="label" color="textSecondary">
                Workouts logged
              </Text>
              <Text variant="title2" tabular style={{ marginTop: t.spacing.xs }}>
                {totalCount}
              </Text>
            </Card>
            <Card padding="md" style={{ flex: 1, justifyContent: 'center' }}>
              <Text variant="label" color="textSecondary">
                Last volume
              </Text>
              <Text
                variant="bodyStrong"
                color="accent"
                tabular
                numberOfLines={1}
                style={{ marginTop: t.spacing.xs }}
              >
                {lastVolume}
              </Text>
            </Card>
          </View>
        </View>

        <Text variant="label" color="textSecondary" style={{ marginBottom: t.spacing.md }}>
          Workout history
        </Text>

        {loadingHistory ? (
          <View style={{ paddingVertical: t.spacing.xxxl, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={t.color.accent} />
          </View>
        ) : history.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.xxl }}>
            <AlertCircle size={24} color={t.color.textTertiary} />
            <Text variant="body" color="textSecondary">
              No workouts logged yet
            </Text>
            <Button label="Start your first workout" onPress={() => startWorkout('Blank Session')} />
          </Card>
        ) : (
          history.map((workout) => (
            <HistoryCard key={workout.id} workout={workout} formatWeight={formatWeight} />
          ))
        )}

        {loadingMore ? (
          <View style={{ paddingVertical: t.spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={t.color.accent} />
          </View>
        ) : null}

        {/* Clears the floating "workout in progress" bar, which is absolutely positioned by
            ActiveWorkoutLogger and would otherwise cover the last history card. A spacer, not
            extra paddingBottom — that would override Screen's tab-bar inset rather than add
            to it, which is how this overlapped in the first place. */}
        {activeWorkout ? <View style={{ height: IN_PROGRESS_BAR_SPACE }} /> : null}
      </Screen>
    </View>
  );
}
