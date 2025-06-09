
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🧹 Iniciando limpeza de contas expiradas...')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Calcular a data limite: 48h atrás (24h de teste + 24h de carência)
    const now = new Date()
    const limitDate = new Date(now.getTime() - 48 * 60 * 60 * 1000)
    
    console.log(`📅 Buscando usuários criados antes de: ${limitDate.toISOString()}`)

    // Buscar apenas usuários criados há mais de 48h usando SQL direto
    const { data: expiredUsers, error: queryError } = await supabaseClient
      .from('auth.users')
      .select('id, email, created_at')
      .lt('created_at', limitDate.toISOString())

    if (queryError) {
      console.log('⚠️ Não foi possível usar consulta SQL direta, usando API admin...')
      
      // Fallback: usar a API admin com paginação (método anterior)
      let allUsers = []
      let page = 1
      const perPage = 1000
      
      while (true) {
        console.log(`📄 Buscando página ${page} de usuários...`)
        
        const { data: authUsers, error: authError } = await supabaseClient.auth.admin.listUsers({
          page: page,
          perPage: perPage
        })
        
        if (authError) {
          console.error('❌ Erro ao buscar usuários do auth:', authError)
          throw authError
        }

        console.log(`📊 Página ${page}: ${authUsers.users.length} usuários encontrados`)
        
        if (authUsers.users.length === 0) {
          break
        }
        
        allUsers.push(...authUsers.users)
        
        if (authUsers.users.length < perPage) {
          break
        }
        
        page++
      }

      // Filtrar usuários criados há mais de 48h
      const filteredUsers = allUsers.filter(user => {
        const userCreatedAt = new Date(user.created_at)
        const isExpired = userCreatedAt < limitDate
        console.log(`🔍 Usuário ${user.email} criado em ${user.created_at} - Expirado: ${isExpired}`)
        return isExpired
      })

      console.log(`👥 Total de usuários: ${allUsers.length}, Expirados: ${filteredUsers.length}`)
      
      // Usar os dados filtrados
      var usersToCheck = filteredUsers
      var totalUsersCount = allUsers.length
    } else {
      console.log(`👥 Encontrados ${expiredUsers.length} usuários criados há mais de 48h`)
      var usersToCheck = expiredUsers
      var totalUsersCount = expiredUsers.length // Não temos o total neste caso
    }

    let deletedCount = 0

    for (const user of usersToCheck) {
      console.log(`🔍 Verificando usuário ${user.email} (${user.id}) criado em ${user.created_at}`)
      
      // Verificar se tem assinatura ativa
      const { data: activeSubscription, error: activeSubError } = await supabaseClient
        .from('subscriptions')
        .select('id, status, expires_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gte('expires_at', now.toISOString())
        .maybeSingle()

      if (activeSubError && activeSubError.code !== 'PGRST116') {
        console.error(`❌ Erro ao verificar assinatura ativa para ${user.email}:`, activeSubError)
        continue
      }

      if (activeSubscription) {
        console.log(`✅ Usuário ${user.email} tem assinatura ativa, mantendo conta`)
        continue
      }

      // Verificar se já teve alguma assinatura paga (mesmo expirada)
      const { data: anySubscription, error: anySubError } = await supabaseClient
        .from('subscriptions')
        .select('id, status, payment_method, amount')
        .eq('user_id', user.id)
        .in('status', ['active', 'expired', 'cancelled'])
        .maybeSingle()

      if (anySubError && anySubError.code !== 'PGRST116') {
        console.error(`❌ Erro ao verificar histórico de assinaturas para ${user.email}:`, anySubError)
        continue
      }

      if (anySubscription) {
        console.log(`💰 Usuário ${user.email} já teve assinatura paga (${anySubscription.status}), mantendo conta`)
        continue
      }

      // Se chegou até aqui, é um usuário que nunca pagou e passou das 48h
      console.log(`🗑️ Excluindo usuário ${user.email} - nunca teve assinatura paga e passou de 48h`)
      
      try {
        // Excluir dados relacionados primeiro
        console.log(`🧹 Limpando dados relacionados do usuário ${user.email}`)
        
        // Excluir em ordem para evitar problemas de foreign key
        await supabaseClient.from('ai_conversations').delete().eq('user_id', user.id)
        await supabaseClient.from('user_progress').delete().eq('user_id', user.id)
        await supabaseClient.from('user_workout_plans').delete().eq('user_id', user.id)
        await supabaseClient.from('workout_plans').delete().eq('user_id', user.id)
        await supabaseClient.from('user_profiles').delete().eq('user_id', user.id)
        await supabaseClient.from('plan_progress').delete().eq('user_id', user.id)
        await supabaseClient.from('subscriptions').delete().eq('user_id', user.id)
        await supabaseClient.from('profiles').delete().eq('id', user.id)

        // Excluir usuário do auth (isso vai cascatear outras exclusões)
        const { error: deleteAuthError } = await supabaseClient.auth.admin.deleteUser(user.id)
        
        if (deleteAuthError) {
          console.error(`❌ Erro ao excluir usuário ${user.email} do auth:`, deleteAuthError)
        } else {
          deletedCount++
          console.log(`✅ Usuário ${user.email} excluído com sucesso`)
        }
      } catch (deleteError) {
        console.error(`❌ Erro ao excluir usuário ${user.email}:`, deleteError)
      }
    }

    console.log(`🎯 Limpeza concluída: ${deletedCount} contas excluídas`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Limpeza concluída: ${deletedCount} contas excluídas`,
        deletedCount,
        checkedUsers: usersToCheck.length,
        totalUsers: totalUsersCount,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('💥 Erro na limpeza de contas:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
