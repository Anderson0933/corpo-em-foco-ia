
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Trophy, Calendar, Target, Zap, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface WorkoutStreakProps {
  user: User | null;
}

const WorkoutStreak = ({ user }: WorkoutStreakProps) => {
  const [streakData, setStreakData] = useState({
    currentStreak: 0,
    bestStreak: 0,
    totalWorkouts: 0,
    lastWorkoutDate: null as Date | null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStreakData();
    }
  }, [user]);

  const fetchStreakData = async () => {
    if (!user) return;

    try {
      // Buscar todos os treinos completados ordenados por data
      const { data: progressData } = await supabase
        .from('plan_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', true)
        .order('created_at', { ascending: true });

      if (progressData && progressData.length > 0) {
        const workoutDates = progressData.map(p => new Date(p.created_at).toDateString());
        const uniqueDates = [...new Set(workoutDates)].sort();
        
        const currentStreak = calculateCurrentStreak(uniqueDates);
        const bestStreak = calculateBestStreak(uniqueDates);
        const lastWorkout = new Date(progressData[progressData.length - 1].created_at);

        setStreakData({
          currentStreak,
          bestStreak,
          totalWorkouts: progressData.length,
          lastWorkoutDate: lastWorkout
        });
      } else {
        setStreakData({
          currentStreak: 0,
          bestStreak: 0,
          totalWorkouts: 0,
          lastWorkoutDate: null
        });
      }
    } catch (error) {
      console.error('Erro ao buscar dados do streak:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCurrentStreak = (dates: string[]) => {
    if (dates.length === 0) return 0;

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    
    // Verificar se treinou hoje ou ontem para manter o streak
    const lastWorkoutDate = dates[dates.length - 1];
    if (lastWorkoutDate !== today && lastWorkoutDate !== yesterday) {
      return 0;
    }

    let streak = 1;
    for (let i = dates.length - 2; i >= 0; i--) {
      const currentDate = new Date(dates[i + 1]);
      const previousDate = new Date(dates[i]);
      const diffDays = Math.floor((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const calculateBestStreak = (dates: string[]) => {
    if (dates.length === 0) return 0;

    let bestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < dates.length; i++) {
      const currentDate = new Date(dates[i]);
      const previousDate = new Date(dates[i - 1]);
      const diffDays = Math.floor((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }
    return bestStreak;
  };

  const getStreakLevel = (streak: number) => {
    if (streak >= 30) return { level: 'Lenda', color: 'from-purple-500 to-pink-500', icon: <Award className="h-5 w-5" /> };
    if (streak >= 21) return { level: 'Mestre', color: 'from-yellow-500 to-orange-500', icon: <Trophy className="h-5 w-5" /> };
    if (streak >= 14) return { level: 'Veterano', color: 'from-blue-500 to-indigo-500', icon: <Target className="h-5 w-5" /> };
    if (streak >= 7) return { level: 'Campeão', color: 'from-green-500 to-blue-500', icon: <Zap className="h-5 w-5" /> };
    if (streak >= 3) return { level: 'Iniciante', color: 'from-orange-500 to-red-500', icon: <Flame className="h-5 w-5" /> };
    return { level: 'Começando', color: 'from-gray-400 to-gray-500', icon: <Calendar className="h-5 w-5" /> };
  };

  const getMotivationalMessage = (streak: number) => {
    if (streak === 0) return "Comece hoje sua jornada! 💪";
    if (streak >= 30) return "Você é uma inspiração! Continue assim! 🔥";
    if (streak >= 21) return "Hábito formado! Você é imparável! ⚡";
    if (streak >= 14) return "Duas semanas consecutivas! Incrível! 🚀";
    if (streak >= 7) return "Uma semana inteira! Que disciplina! 🏆";
    if (streak >= 3) return "Momentum crescendo! Continue! 💥";
    return "Bom começo! Mantenha o ritmo! 🎯";
  };

  if (loading) {
    return (
      <Card className="bg-white border-gray-200 shadow-lg">
        <CardContent className="p-6">
          <div className="animate-pulse flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-300 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-300 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const streakLevel = getStreakLevel(streakData.currentStreak);
  const motivationalMessage = getMotivationalMessage(streakData.currentStreak);

  return (
    <Card className="bg-white border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
      <CardHeader className={`bg-gradient-to-r ${streakLevel.color} text-white relative`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Flame className="h-7 w-7 text-white" />
            </div>
            <div>
              <CardTitle className="text-white text-lg font-bold">Streak de Treinos</CardTitle>
              <Badge className="bg-white/20 text-white border-white/30 mt-1">
                {streakLevel.icon}
                <span className="ml-1">{streakLevel.level}</span>
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{streakData.currentStreak}</div>
            <div className="text-white/90 text-sm">dias</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Mensagem Motivacional */}
          <div className={`p-4 rounded-lg bg-gradient-to-r ${streakLevel.color} bg-opacity-10 border border-opacity-20`}>
            <p className="text-gray-800 font-medium text-center">{motivationalMessage}</p>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-center mb-2">
                <Trophy className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-blue-800 font-semibold">Melhor Streak</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{streakData.bestStreak}</div>
              <div className="text-blue-600/70 text-sm">dias consecutivos</div>
            </div>

            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-center mb-2">
                <Target className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-green-800 font-semibold">Total Treinos</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{streakData.totalWorkouts}</div>
              <div className="text-green-600/70 text-sm">completados</div>
            </div>
          </div>

          {/* Último Treino */}
          {streakData.lastWorkoutDate && (
            <div className="flex items-center justify-center gap-2 text-gray-600 bg-gray-50 p-3 rounded-lg">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">
                Último treino: {streakData.lastWorkoutDate.toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkoutStreak;
