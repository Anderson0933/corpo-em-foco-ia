import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
// Import the existing Supabase client
import { supabase } from '@/integrations/supabase/client'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Dumbbell, Target, Clock, User as UserIcon, Zap, RefreshCw, Copy, FileText, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface PlanProgressItem {
  id?: number;
  user_id: string;
  plan_id: string;
  item_identifier: string;
  is_completed: boolean;
  created_at?: string;
  updated_at?: string;
}

const getPlanProgress = async (userId: string, planId: string): Promise<Map<string, boolean>> => {
  console.log(`[Supabase] Fetching progress for user ${userId}, plan ${planId}`);
  const { data, error } = await supabase
    .from('plan_progress')
    .select('item_identifier, is_completed')
    .eq('user_id', userId)
    .eq('plan_id', planId);

  if (error) {
    console.error('[Supabase] Error fetching plan progress:', error);
    throw error;
  }

  const progressMap = new Map<string, boolean>();
  data?.forEach(item => {
    progressMap.set(item.item_identifier, item.is_completed);
  });
  console.log(`[Supabase] Fetched ${progressMap.size} progress items.`);
  return progressMap;
};

const updateItemProgress = async (progressItem: Omit<PlanProgressItem, 'id' | 'created_at' | 'updated_at'>) => {
  console.log(`[Supabase] Upserting progress for item: ${progressItem.item_identifier}, status: ${progressItem.is_completed}`);
  const { data, error } = await supabase
    .from('plan_progress')
    .upsert(progressItem, {
      onConflict: 'user_id, plan_id, item_identifier'
    })
    .select();

  if (error) {
    console.error('[Supabase] Error updating item progress:', error);
    throw error;
  }
  console.log(`[Supabase] Progress upserted successfully for item: ${progressItem.item_identifier}`);
  return data;
};

const deletePlanProgress = async (userId: string, planId: string) => {
  console.log(`[Supabase] Deleting progress for user ${userId}, plan ${planId}`);
  const { error } = await supabase
    .from('plan_progress')
    .delete()
    .eq('user_id', userId)
    .eq('plan_id', planId);

  if (error) {
    console.error('[Supabase] Error deleting plan progress:', error);
    throw error;
  }
  console.log(`[Supabase] Progress deleted successfully for plan: ${planId}`);
};

export interface WorkoutPlan {
  id?: string;
  title: string;
  description: string;
  difficulty_level: string;
  duration_weeks: number;
  exercises: Array<{
    name: string;
    sets: number;
    reps: string;
    rest: string;
    instructions: string;
  }>;
  nutrition_tips: string[];
}

interface WorkoutPlanGeneratorProps {
  user: User | null;
  workoutPlan: WorkoutPlan | null;
  setWorkoutPlan: (plan: WorkoutPlan | null) => void;
  initialActiveTab?: 'form' | 'plan';
}

const WorkoutPlanGenerator = ({ 
  user, 
  workoutPlan, 
  setWorkoutPlan,
  initialActiveTab = 'form'
}: WorkoutPlanGeneratorProps) => {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Persist form data in localStorage to prevent loss
  const [formData, setFormData] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('workout-form-data');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.warn('Failed to parse saved form data:', e);
        }
      }
    }
    return {
      age: '',
      gender: '',
      weight: '',
      height: '',
      fitnessLevel: '',
      goals: [],
      availableTime: '',
      availableDays: '',
      equipment: '',
      limitations: ''
    };
  });

  const [activeTab, setActiveTab] = useState<'form' | 'plan'>(() => 
    workoutPlan ? 'plan' : initialActiveTab
  );
  const [otherLimitationsText, setOtherLimitationsText] = useState("");
  const [otherGoalsText, setOtherGoalsText] = useState("");
  const [progressMap, setProgressMap] = useState<Map<string, boolean>>(new Map());
  const { toast } = useToast();

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('workout-form-data', JSON.stringify(formData));
    }
  }, [formData]);

  // Clear form data from localStorage when plan is generated successfully
  const clearSavedFormData = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('workout-form-data');
    }
  }, []);

  // Load progress when plan and user are available
  useEffect(() => {
    const loadProgress = async () => {
      const currentPlanId = workoutPlan?.title;
      if (user && currentPlanId) { 
        try {
          console.log(`🔄 Loading progress for plan: ${currentPlanId}`);
          const fetchedProgress = await getPlanProgress(user.id, currentPlanId);
          setProgressMap(fetchedProgress);
          console.log(`✅ Progress loaded: ${fetchedProgress.size} items`);
        } catch (error) {
          console.error('❌ Error loading plan progress:', error);
          toast({
            title: "Erro ao Carregar Progresso",
            description: "Não foi possível carregar o estado dos itens concluídos.",
            variant: "destructive",
          });
        }
      } else {
        setProgressMap(new Map());
      }
    };

    loadProgress();
  }, [user, workoutPlan?.title, toast]);

  useEffect(() => {
    if (workoutPlan && activeTab !== 'plan') {
      setActiveTab('plan');
    }
  }, [workoutPlan, activeTab]);

  const handleInputChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleGoalChange = useCallback((goal: string, checked: boolean) => {
    setFormData(prev => {
      const currentGoals = prev.goals || [];
      if (checked) {
        return { ...prev, goals: [...currentGoals, goal] };
      } else {
        const updatedGoals = currentGoals.filter(g => g !== goal);
        if (goal === "outros") {
          setOtherGoalsText("");
        }
        return { ...prev, goals: updatedGoals };
      }
    });
  }, []);

  const handleSelectChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'limitations' && value !== 'outros') {
      setOtherLimitationsText('');
    }
  }, []);

  const handleProgressChange = useCallback(async (itemIdentifier: string, currentStatus: boolean) => {
    const currentPlanId = workoutPlan?.title;
    if (!user || !currentPlanId) return;

    const newStatus = !currentStatus;
    const userId = user.id;
    const planId = currentPlanId;

    setProgressMap(prevMap => new Map(prevMap).set(itemIdentifier, newStatus));

    try {
      await updateItemProgress({
        user_id: userId,
        plan_id: planId,
        item_identifier: itemIdentifier,
        is_completed: newStatus,
      });
      console.log(`✅ Progress updated for item: ${itemIdentifier} to ${newStatus}`);
    } catch (error) {
      console.error('❌ Error updating item progress:', error);
      setProgressMap(prevMap => new Map(prevMap).set(itemIdentifier, currentStatus));
      toast({
        title: "Erro ao Salvar Progresso",
        description: "Não foi possível salvar a alteração. Tente novamente.",
        variant: "destructive",
      });
    }
  }, [user, workoutPlan?.title, toast]);

  const saveWorkoutPlan = async (plan: WorkoutPlan) => {
    if (!user) return;

    console.log('💾 Tentando salvar o plano no DB...');
    try {
      const { error: deleteError } = await supabase
        .from('user_workout_plans')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        console.warn('⚠️ Erro ao deletar plano antigo (pode não existir):', deleteError.message);
      }

      const oldPlanId = workoutPlan?.title;
      if (oldPlanId) {
         console.log(`🗑️ Deleting old progress for plan being replaced: ${oldPlanId}`);
         await deletePlanProgress(user.id, oldPlanId);
      }

      const { data: insertData, error: insertError } = await supabase
        .from('user_workout_plans')
        .insert({
          user_id: user.id,
          plan_data: plan as any
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Erro ao salvar novo plano:', insertError);
        throw new Error('Falha ao salvar o plano de treino no banco de dados.');
      }
      
      const savedPlan = plan;

      console.log('✅ Plano salvo com sucesso no DB!');
      return savedPlan;
    } catch (error: any) {
      console.error('💥 Erro na função saveWorkoutPlan:', error);
      toast({
        title: "Erro ao Salvar Plano",
        description: error.message || "Não foi possível salvar seu plano. Tente gerar novamente.",
        variant: "destructive",
      });
      return null;
    }
  };

  const generateWorkoutPlan = async () => {
    if (!user) {
      toast({ title: "Erro de autenticação", description: "Logue novamente.", variant: "destructive" });
      return;
    }

    const requiredFields = ['age', 'gender', 'weight', 'height', 'fitnessLevel', 'goals'];
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
    if (missingFields.length > 0) {
      toast({ title: "Campos obrigatórios", description: `Preencha: ${missingFields.join(', ')}`, variant: "destructive" });
      return;
    }
    if (isNaN(parseInt(formData.age)) || isNaN(parseInt(formData.height)) || isNaN(parseInt(formData.weight))) {
       toast({ title: "Valores inválidos", description: "Idade, Altura (cm) e Peso (kg) devem ser números.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const oldPlanId = workoutPlan?.title;
    setWorkoutPlan(null);
    setProgressMap(new Map());
    
    try {
      console.log('🚀 INICIANDO GERAÇÃO DO PLANO');
      const sessionDuration = formData.availableTime ? parseInt(formData.availableTime) || 60 : 60;
      const availableDays = formData.availableDays ? parseInt(formData.availableDays) || 3 : 3;

      let finalGoals = formData.goals || [];
      if (finalGoals.includes("outros")) {
        finalGoals = finalGoals.filter(g => g !== "outros");
        if (otherGoalsText.trim()) {
          finalGoals.push(`outros: ${otherGoalsText.trim()}`);
        }
      }
      if (finalGoals.length === 0) {
         finalGoals.push("saude_geral");
         toast({ title: "Objetivo Padrão", description: "Nenhum objetivo selecionado, usando 'Saúde Geral'.", variant: "default" });
      }

      const requestData = {
        userProfile: {
          age: parseInt(formData.age),
          gender: formData.gender,
          weight: parseInt(formData.weight),
          height: parseInt(formData.height),
          fitness_level: formData.fitnessLevel,
          fitness_goals: finalGoals,
          available_days: availableDays,
          session_duration: sessionDuration,
          equipment: formData.equipment || 'peso_corporal',
          limitations: formData.limitations === 'outros'
                        ? `outros: ${otherLimitationsText || 'não especificado'}`
                        : formData.limitations || 'nenhuma'
        },
        userId: user.id
      };

      console.log('📤 Enviando para a API generate-workout-plan...');
      const { data, error: functionError } = await supabase.functions.invoke('generate-workout-plan', {
        body: requestData
      });

      if (functionError) throw new Error(functionError.message || 'Erro na função generate-workout-plan');
      if (!data || typeof data !== 'object' || (!data.title && !data.exercises)) throw new Error('Plano de treino inválido retornado pela API');

      console.log('✅ Dados do plano recebidos da API');
      const plan: WorkoutPlan = {
        title: data.title || 'Plano de Treino Personalizado',
        description: data.description || 'Plano gerado com base no seu perfil',
        difficulty_level: data.difficulty_level || 'iniciante',
        duration_weeks: data.duration_weeks || 8,
        exercises: data.exercises || [],
        nutrition_tips: data.nutrition_tips || []
      };

      const savedPlan = await saveWorkoutPlan(plan);
      if (!savedPlan) {
        setLoading(false);
        return;
      }

      console.log('✅ Plano processado e salvo. Atualizando estado...');
      setWorkoutPlan(savedPlan);
      
      // Clear saved form data after successful generation
      clearSavedFormData();
      
      setActiveTab('plan');
      console.log('✅ Aba interna alterada para "plan"');
      
      toast({
        title: "Plano gerado e salvo!",
        description: "Seu plano de treino personalizado está pronto e salvo.",
      });

    } catch (error: any) {
      console.error('💥 Erro ao gerar/salvar plano:', error);
      setWorkoutPlan(null);
      setProgressMap(new Map());
      toast({
        title: "Erro ao Gerar Plano",
        description: error.message || 'Erro desconhecido.',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkoutPlan = async () => {
    const currentPlanId = workoutPlan?.title;
    if (!user || !currentPlanId) return;

    setDeleting(true);
    console.log('🗑️ Tentando deletar o plano e seu progresso do DB...');
    const planId = currentPlanId;

    try {
      console.log(`🗑️ Deletando progresso para o plano: ${planId}`);
      await deletePlanProgress(user.id, planId);
      console.log('✅ Progresso deletado com sucesso!');

      console.log(`🗑️ Deletando plano: ${planId}`);
      const { error: deletePlanError } = await supabase
        .from('user_workout_plans')
        .delete()
        .eq('user_id', user.id);

      if (deletePlanError) {
        console.error('❌ Erro ao deletar plano:', deletePlanError);
        toast({
          title: "Erro Parcial ao Excluir",
          description: "Não foi possível excluir os dados do plano, mas o progresso foi removido.",
          variant: "destructive",
        });
      } else {
         console.log('✅ Plano deletado com sucesso do DB!');
      }

      setWorkoutPlan(null);
      setProgressMap(new Map());
      setActiveTab('form');
      toast({
        title: "Plano Excluído",
        description: "Seu plano de treino e progresso foram removidos.",
      });

    } catch (error: any) {
      console.error('💥 Erro na função deleteWorkoutPlan:', error);
      toast({
        title: "Erro ao Excluir Plano",
        description: error.message || "Não foi possível excluir seu plano ou progresso.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const copyPlan = () => {
    if (workoutPlan) {
      let planText = `🏋️ ${workoutPlan.title}\n\n`;
      planText += `📝 DESCRIÇÃO:\n${workoutPlan.description}\n\n`;
      planText += `📊 NÍVEL: ${workoutPlan.difficulty_level.toUpperCase()}\n`;
      planText += `⏱️ DURAÇÃO: ${workoutPlan.duration_weeks} semanas\n\n`;
      planText += `💪 EXERCÍCIOS:\n\n`;
      workoutPlan.exercises.forEach((exercise, index) => {
        const itemIdentifier = `${exercise.name}_${index}`;
        const isCompleted = progressMap.get(itemIdentifier) || false;
        planText += `${isCompleted ? '[✅]' : '[ ]'} ${index + 1}. ${exercise.name}\n`;
        planText += `   📊 Séries: ${exercise.sets}\n`;
        planText += `   🔢 Repetições: ${exercise.reps}\n`;
        planText += `   ⏰ Descanso: ${exercise.rest}\n`;
        planText += `   📋 ${exercise.instructions}\n\n`;
      });
      if (workoutPlan.nutrition_tips.length > 0) {
        planText += `🥗 DICAS NUTRICIONAIS:\n\n`;
        workoutPlan.nutrition_tips.forEach((tip, index) => {
          planText += `${index + 1}. ${tip}\n`;
        });
      }
      navigator.clipboard.writeText(planText);
      toast({ title: "Copiado!", description: "Plano de treino (com progresso) copiado." });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Card */}
      <Card className="bg-white border-blue-200 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Dumbbell className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-blue-800 text-2xl">Gerador de Plano de Treino</CardTitle>
          <CardDescription className="text-blue-600">
            Crie ou visualize seu plano de treino personalizado com IA
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'form' | 'plan')} className="w-full">
        {/* Tabs List */}
        <TabsList className="grid w-full grid-cols-2 mb-6 bg-white border border-blue-200 shadow-sm h-12">
          <TabsTrigger 
            value="form" 
            className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-700 py-3"
          >
            <UserIcon className="h-4 w-4" />
            {workoutPlan ? 'Gerar Novo Plano' : 'Criar Plano'}
          </TabsTrigger>
          <TabsTrigger 
            value="plan" 
            className="flex items-center gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white text-blue-700 py-3"
            disabled={!workoutPlan}
          >
            <FileText className="h-4 w-4" />
            Seu Plano Atual
            {workoutPlan && (
              <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full ml-1">
                Salvo
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Form Tab Content */}
        <TabsContent value="form">
          <Card className="bg-white border-blue-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-blue-800 flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Informações para Gerar seu Plano
              </CardTitle>
              {workoutPlan && (
                 <CardDescription className="text-orange-600 flex items-center gap-1 text-sm pt-2">
                   <AlertTriangle className="h-4 w-4" />
                   Gerar um novo plano substituirá o plano atual salvo e seu progresso.
                 </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="age" className="text-blue-700 font-medium">Idade *</Label>
                  <Input 
                    id="age"
                    type="number" 
                    placeholder="Sua idade em anos" 
                    value={formData.age} 
                    onChange={(e) => handleInputChange('age', e.target.value)} 
                    className="border-blue-200 focus:border-blue-400 mt-2"
                  />
                </div>
                <div>
                  <Label className="text-blue-700 font-medium">Sexo *</Label>
                  <RadioGroup
                    value={formData.gender}
                    onValueChange={(value) => handleInputChange('gender', value)}
                    className="flex flex-wrap gap-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="masculino" id="masculino" />
                      <Label htmlFor="masculino" className="text-sm">Masculino</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="feminino" id="feminino" />
                      <Label htmlFor="feminino" className="text-sm">Feminino</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="outro" id="outro" />
                      <Label htmlFor="outro" className="text-sm">Outro</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="height" className="text-blue-700 font-medium">Altura (cm) *</Label>
                  <Input 
                    id="height"
                    type="number" 
                    placeholder="Sua altura em cm" 
                    value={formData.height} 
                    onChange={(e) => handleInputChange('height', e.target.value)} 
                    className="border-blue-200 focus:border-blue-400 mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="weight" className="text-blue-700 font-medium">Peso (kg) *</Label>
                  <Input 
                    id="weight"
                    type="number" 
                    placeholder="Seu peso em kg" 
                    value={formData.weight} 
                    onChange={(e) => handleInputChange('weight', e.target.value)} 
                    className="border-blue-200 focus:border-blue-400 mt-2"
                  />
                </div>
              </div>

              <div>
                <Label className="text-blue-700 font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Nível de Condicionamento Atual *
                </Label>
                <RadioGroup value={formData.fitnessLevel} onValueChange={(value) => handleInputChange('fitnessLevel', value)} className="mt-3 space-y-3">
                  <div className="flex items-center space-x-2 p-3 border border-blue-200 rounded-lg hover:bg-blue-50"><RadioGroupItem value="sedentario" id="sedentario" /><Label htmlFor="sedentario" className="flex items-center gap-2 cursor-pointer">🟡 Sedentário</Label></div>
                  <div className="flex items-center space-x-2 p-3 border border-blue-200 rounded-lg hover:bg-blue-50"><RadioGroupItem value="iniciante" id="iniciante" /><Label htmlFor="iniciante" className="flex items-center gap-2 cursor-pointer">🟠 Iniciante</Label></div>
                  <div className="flex items-center space-x-2 p-3 border border-blue-200 rounded-lg hover:bg-blue-50"><RadioGroupItem value="intermediario" id="intermediario" /><Label htmlFor="intermediario" className="flex items-center gap-2 cursor-pointer">🟢 Intermediário</Label></div>
                  <div className="flex items-center space-x-2 p-3 border border-blue-200 rounded-lg hover:bg-blue-50"><RadioGroupItem value="avancado" id="avancado" /><Label htmlFor="avancado" className="flex items-center gap-2 cursor-pointer">🏆 Avançado</Label></div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-blue-700 font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" /> Objetivos Principais (selecione um ou mais) *
                </Label>
                <div className="mt-3 space-y-3">
                  {[
                    { value: "perda_peso", label: "📉 Perda de Peso / Gordura" },
                    { value: "hipertrofia", label: "💪 Ganho de Massa Muscular" },
                    { value: "condicionamento", label: "❤️ Melhora Cardiovascular" },
                    { value: "forca", label: "⚡ Aumento de Força" },
                    { value: "saude_geral", label: "🧘 Saúde Geral / Manutenção" },
                    { value: "outros", label: "⚠️ Outros (descreva abaixo)" }
                  ].map((goal) => (
                    <div key={goal.value} className="flex items-center space-x-2 p-3 border border-blue-200 rounded-lg hover:bg-blue-50">
                      <Checkbox
                        id={goal.value}
                        checked={(formData.goals || []).includes(goal.value)}
                        onCheckedChange={(checked) => handleGoalChange(goal.value, !!checked)}
                      />
                      <Label htmlFor={goal.value} className="flex items-center gap-2 cursor-pointer">
                        {goal.label}
                      </Label>
                    </div>
                  ))}
                </div>
                {(formData.goals || []).includes("outros") && (
                  <div className="mt-4">
                    <Label htmlFor="otherGoals" className="text-blue-700 font-medium">Descreva seus outros objetivos:</Label>
                    <Input
                      id="otherGoals"
                      type="text"
                      placeholder="Ex: Preparação para maratona, reabilitação..."
                      value={otherGoalsText}
                      onChange={(e) => setOtherGoalsText(e.target.value)}
                      className="border-blue-200 focus:border-blue-400 mt-2"
                    />
                  </div>
                )}
              </div>

              <div>
                <Label className="text-blue-700 font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Tempo Disponível por Treino
                </Label>
                <Select value={formData.availableTime} onValueChange={(value) => handleSelectChange('availableTime', value)}>
                  <SelectTrigger className="border-blue-200 focus:border-blue-400 mt-2"><SelectValue placeholder="Selecione o tempo (opcional, padrão 60min)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">⏰ 30 min</SelectItem>
                    <SelectItem value="45">⏰ 45 min</SelectItem>
                    <SelectItem value="60">⏰ 60 min</SelectItem>
                    <SelectItem value="90">⏰ 90 min</SelectItem>
                    <SelectItem value="120">⏰ 2 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-blue-700 font-medium flex items-center gap-2">
                  🗓️ Dias Disponíveis por Semana *
                </Label>
                <Select value={formData.availableDays} onValueChange={(value) => handleSelectChange("availableDays", value)}>
                  <SelectTrigger className="border-blue-200 focus:border-blue-400 mt-2"><SelectValue placeholder="Selecione quantos dias na semana" /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map(day => (
                      <SelectItem key={day} value={String(day)}>{day} dia{day > 1 ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-blue-700 font-medium">Equipamentos Disponíveis</Label>
                <Select value={formData.equipment} onValueChange={(value) => handleSelectChange('equipment', value)}>
                  <SelectTrigger className="border-blue-200 focus:border-blue-400 mt-2"><SelectValue placeholder="Selecione os equipamentos (opcional, padrão peso corporal)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academia_completa">🏢 Academia completa</SelectItem>
                    <SelectItem value="casa_halteres">🏠 Casa com halteres</SelectItem>
                    <SelectItem value="casa_basico">🏠 Casa básicos (elásticos, etc)</SelectItem>
                    <SelectItem value="peso_corporal">🤸 Peso corporal</SelectItem>
                    <SelectItem value="parque">🌳 Parque (barras, etc)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-blue-700 font-medium">Limitações Físicas</Label>
                <Select value={formData.limitations} onValueChange={(value) => handleSelectChange('limitations', value)}>
                  <SelectTrigger className="border-blue-200 focus:border-blue-400 mt-2"><SelectValue placeholder="Selecione limitações (opcional, padrão nenhuma)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">✅ Nenhuma</SelectItem>
                    <SelectItem value="joelho">🦵 Joelho</SelectItem>
                    <SelectItem value="costas">🔙 Costas</SelectItem>
                    <SelectItem value="ombro">💪 Ombro</SelectItem>
                    <SelectItem value="tornozelo">🦶 Tornozelo</SelectItem>
                    <SelectItem value="cardiaco">❤️ Cardíaco</SelectItem>
                    <SelectItem value="outros">⚠️ Outras (descreva se possível)</SelectItem>
                  </SelectContent>
                </Select>
                {formData.limitations === 'outros' && (
                  <div className="mt-4">
                    <Label htmlFor="otherLimitations" className="text-blue-700 font-medium">Descreva suas outras limitações:</Label>
                    <Input 
                      id="otherLimitations"
                      type="text" 
                      placeholder="Ex: Tendinite no pulso, asma leve..." 
                      value={otherLimitationsText} 
                      onChange={(e) => setOtherLimitationsText(e.target.value)} 
                      className="border-blue-200 focus:border-blue-400 mt-2"
                    />
                  </div>
                )}
              </div>

              <Button 
                onClick={generateWorkoutPlan}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 text-lg"
                disabled={loading}
              >
                {loading ? (
                  <><RefreshCw className="h-5 w-5 mr-2 animate-spin" /> Gerando...</>
                ) : (
                  <><Dumbbell className="h-5 w-5 mr-2" /> {workoutPlan ? 'Gerar e Substituir Plano' : 'Gerar Plano de Treino'}</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plan Tab Content */}
        <TabsContent value="plan">
          <Card className="bg-white border-green-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-green-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Seu Plano de Treino Atual
                </div>
                 <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive"
                      size="sm"
                      disabled={deleting}
                      className="flex items-center gap-1"
                    >
                      {deleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      <span className="hidden sm:inline">Excluir Plano</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir seu plano de treino atual e todo o progresso registrado? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={deleteWorkoutPlan}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Confirmar Exclusão
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workoutPlan ? (
                <div className="space-y-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-green-800 mb-3">{workoutPlan.title}</h3>
                    <p className="text-green-700 mb-4">{workoutPlan.description}</p>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-white p-3 rounded-lg border border-green-200">
                        <span className="text-sm text-green-600 font-medium">Nível</span>
                        <p className="text-green-800 font-bold capitalize">{workoutPlan.difficulty_level}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-green-200">
                        <span className="text-sm text-green-600 font-medium">Duração</span>
                        <p className="text-green-800 font-bold">{workoutPlan.duration_weeks} semanas</p>
                      </div>
                    </div>
                    {workoutPlan.exercises && workoutPlan.exercises.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-lg font-bold text-green-800 mb-3">💪 Exercícios</h4>
                        <div className="space-y-4">
                          {workoutPlan.exercises.map((exercise, index) => {
                            const itemIdentifier = `${exercise.name}_${index}`; 
                            const isCompleted = progressMap.get(itemIdentifier) || false;
                            return (
                              <div key={itemIdentifier} className={`bg-white p-4 rounded-lg border ${isCompleted ? 'border-green-400 bg-green-50' : 'border-gray-200'} transition-colors duration-200`}>
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className={`font-bold ${isCompleted ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                                    {index + 1}. {exercise.name}
                                  </h5>
                                  <div className="flex items-center space-x-2">
                                    <Label htmlFor={`item-${itemIdentifier}`} className="text-sm text-gray-600 cursor-pointer">
                                      {isCompleted ? 'Concluído' : 'Marcar como concluído'}
                                    </Label>
                                    <Checkbox
                                      id={`item-${itemIdentifier}`}
                                      checked={isCompleted}
                                      onCheckedChange={() => handleProgressChange(itemIdentifier, isCompleted)}
                                      className={`data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 ${isCompleted ? 'border-green-600' : 'border-gray-400'}`}
                                      aria-label={`Marcar ${exercise.name} como ${isCompleted ? 'não concluído' : 'concluído'}`}
                                    />
                                  </div>
                                </div>
                                <div className={`grid grid-cols-3 gap-2 mb-2 text-sm ${isCompleted ? 'text-gray-500' : 'text-gray-600'}`}>
                                  <span>📊 Séries: <strong>{exercise.sets}</strong></span>
                                  <span>🔢 Reps: <strong>{exercise.reps}</strong></span>
                                  <span>⏰ Descanso: <strong>{exercise.rest}</strong></span>
                                </div>
                                <p className={`text-sm ${isCompleted ? 'text-gray-500' : 'text-gray-700'}`}>{exercise.instructions}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {workoutPlan.nutrition_tips && workoutPlan.nutrition_tips.length > 0 && (
                      <div>
                        <h4 className="text-lg font-bold text-green-800 mb-3">🥗 Dicas Nutricionais</h4>
                        <ul className="space-y-2">
                          {workoutPlan.nutrition_tips.map((tip, index) => (
                            <li key={index} className="text-green-700 flex items-start gap-2">
                              <span className="text-green-600 font-bold">{index + 1}.</span> {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button 
                      onClick={copyPlan}
                      variant="outline"
                      className="flex-1 border-green-300 text-green-700 hover:bg-green-50 flex items-center gap-2"
                    >
                      <Copy className="h-4 w-4" /> Copiar Plano (com Progresso)
                    </Button>
                    <Button 
                      onClick={() => setActiveTab('form')}
                      variant="outline"
                      className="border-blue-300 text-blue-700 hover:bg-blue-50 flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" /> Gerar Novo
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4"><FileText className="h-8 w-8 text-gray-400" /></div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Nenhum plano salvo</h3>
                  <p className="text-gray-500 mb-6">Vá para "Criar Plano" para gerar seu treino.</p>
                  <Button onClick={() => setActiveTab('form')} className="bg-blue-600 hover:bg-blue-700 text-white"><Dumbbell className="h-4 w-4 mr-2" /> Criar Meu Plano</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkoutPlanGenerator;
