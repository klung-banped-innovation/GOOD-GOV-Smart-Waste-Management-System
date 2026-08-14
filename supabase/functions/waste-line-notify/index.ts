import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  customer_id: string;
  payment_id?: string;
  notification_type: 'PAYMENT_SUCCESS' | 'OVERDUE';
  amount?: number;
  receipt_no?: string;
  customer_name?: string;
  house_no?: string;
  receipt_url?: string;
  unpaid_count?: number;
  unpaid_months_text?: string;
  payment_url?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const lineAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase URL or Service Key not configured.')
    }
    if (!lineAccessToken) {
      throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured.')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const payload: NotificationPayload = await req.json()
    const { customer_id, payment_id, notification_type, amount, receipt_no, customer_name, house_no, receipt_url, unpaid_count, unpaid_months_text, payment_url } = payload

    if (!customer_id || !notification_type) {
      throw new Error('Missing required fields: customer_id or notification_type')
    }

    // 1. Find all active LINE accounts linked to this customer
    const { data: links, error: linksError } = await supabase
      .from('waste_customer_line_links')
      .select('line_user_id')
      .eq('customer_id', customer_id)
      .eq('status', 'active')

    if (linksError) throw linksError
    
    if (!links || links.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active LINE accounts linked to this customer.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 2. Prepare the LINE Message (Flex Message or Text)
    let messageTitle = ''
    let messageText = ''
    let lineMessageObj: any = {}

    if (notification_type === 'PAYMENT_SUCCESS') {
      messageTitle = 'แจ้งชำระเงินสำเร็จ'
      messageText = `แจ้งชำระเงินสำเร็จ\n\nชื่อ: ${customer_name || '-'}\nบ้านเลขที่: ${house_no || '-'}\nยอดชำระ: ${amount || 0} บาท\nเลขที่ใบเสร็จ: ${receipt_no || '-'}`
      
      const flexContents: any = {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "ชำระเงินสำเร็จ", weight: "bold", color: "#1DB446", size: "lg" }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: `บ้านเลขที่: ${house_no || '-'}`, size: "sm" },
            { type: "text", text: `ชื่อ: ${customer_name || '-'}`, size: "sm" },
            { type: "text", text: `ยอดชำระ: ฿${amount || 0}`, size: "md", weight: "bold", margin: "md" },
            { type: "text", text: `เลขที่ใบเสร็จ: ${receipt_no || '-'}`, size: "xs", color: "#aaaaaa", margin: "sm" }
          ]
        }
      }
      
      if (receipt_url) {
        flexContents.footer = {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "link",
              height: "sm",
              action: {
                type: "uri",
                label: "ดูใบเสร็จ",
                uri: receipt_url
              }
            }
          ]
        }
      }
      
      lineMessageObj = {
        type: 'flex',
        altText: 'แจ้งชำระเงินสำเร็จ',
        contents: flexContents
      }
    } else if (notification_type === 'OVERDUE') {
      messageTitle = 'แจ้งเตือนค้างชำระค่าธรรมเนียมขยะ'
      messageText = `แจ้งเตือนค้างชำระ\n\nชื่อ: ${customer_name || '-'}\nบ้านเลขที่: ${house_no || '-'}\nยอดค้างชำระ: ${amount || 0} บาท\nโปรดชำระภายในกำหนดเพื่อหลีกเลี่ยงค่าปรับ`
      
      const overdueFlexContents: any = {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "แจ้งค้างชำระ", weight: "bold", color: "#ff334b", size: "lg" }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: `บ้านเลขที่: ${house_no || '-'}`, size: "md", weight: "bold", color: "#000000" },
            { type: "text", text: `ชื่อ: ${customer_name || '-'}`, size: "sm", margin: "sm" }
          ]
        }
      }

      if (unpaid_count && unpaid_count > 0) {
        overdueFlexContents.body.contents.push({ 
          type: "text", 
          text: `จำนวนเดือนค้าง: ${unpaid_count} เดือน`, 
          size: "sm",
          color: "#ff334b",
          margin: "sm" 
        })
      }

      if (unpaid_months_text) {
        overdueFlexContents.body.contents.push({ 
          type: "text", 
          text: `ประจำเดือน: ${unpaid_months_text}`, 
          size: "xs", 
          wrap: true,
          color: "#555555" 
        })
      }

      overdueFlexContents.body.contents.push(
        { type: "text", text: `ยอดค้างชำระ: ฿${amount || 0}`, size: "md", weight: "bold", color: "#ff334b", margin: "md" },
        { type: "text", text: "โปรดชำระภายในกำหนด", size: "xs", color: "#aaaaaa", margin: "sm" }
      )

      if (payment_url) {
        overdueFlexContents.footer = {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "primary",
              height: "sm",
              color: "#ff334b",
              action: {
                type: "uri",
                label: "กดชำระเงิน",
                uri: payment_url
              }
            }
          ]
        }
      }

      lineMessageObj = {
        type: 'flex',
        altText: 'แจ้งเตือนค้างชำระค่าธรรมเนียมขยะ',
        contents: overdueFlexContents
      }
    } else {
      throw new Error(`Invalid notification_type: ${notification_type}`)
    }

    // 3. Send notifications and log results individually
    const results = []

    for (const link of links) {
      const lineUserId = link.line_user_id
      let deliveryStatus = 'pending'
      let errorMessage = null

      try {
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lineAccessToken}`
          },
          body: JSON.stringify({
            to: lineUserId,
            messages: [lineMessageObj]
          })
        })

        if (!response.ok) {
          const errData = await response.text()
          throw new Error(`LINE API Error: ${response.status} ${errData}`)
        }

        deliveryStatus = 'sent'
      } catch (err: any) {
        deliveryStatus = 'failed'
        errorMessage = err.message
      }

      // Log to waste_line_notifications
      await supabase.from('waste_line_notifications').insert([{
        line_user_id: lineUserId,
        customer_id,
        payment_id: payment_id || null,
        notification_type,
        title: messageTitle,
        message: messageText,
        status: deliveryStatus,
        sent_at: deliveryStatus === 'sent' ? new Date().toISOString() : null,
        error_message: errorMessage
      }])

      results.push({
        line_user_id: lineUserId,
        status: deliveryStatus,
        error: errorMessage
      })
    }

    return new Response(
      JSON.stringify({ 
        message: 'Notifications processed', 
        total_linked: links.length, 
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('Function Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
