import type { FlexCategory } from '@/db/schema/line-oa';

export type FlexTemplateSeed = {
  name: string;
  description: string;
  category: FlexCategory;
  tags: string[];
  altText: string;
  flexPayload: Record<string, unknown>;
};

const LINE_GREEN = '#06C755';
const DANGER_RED = '#D32F2F';
const WARNING_ORANGE = '#F57C00';
const SUCCESS_GREEN = '#388E3C';
const INFO_BLUE = '#1565C0';

export const AGRISPARK_TEMPLATES: FlexTemplateSeed[] = [
  // 1. Pest/Disease Diagnosis Result
  {
    name: 'agrispark-diagnosis-result',
    description: 'ผลการวินิจฉัยโรคและแมลงศัตรูพืช (ระดับความเสี่ยงปานกลาง/ต่ำ)',
    category: 'agriculture',
    tags: ['diagnosis', 'pest', 'disease', 'agrispark'],
    altText: 'ผลการวินิจฉัยพืช',
    flexPayload: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: SUCCESS_GREEN,
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: '🔍 ผลการวินิจฉัย',
            color: '#FFFFFF',
            size: 'lg',
            weight: 'bold',
          },
          {
            type: 'text',
            text: '{{crop_name}}',
            color: '#FFFFFF',
            size: 'sm',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'โรค/แมลง', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '{{diagnosis}}', size: 'sm', weight: 'bold', flex: 3, wrap: true },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ระดับความเสี่ยง', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '{{severity}}', size: 'sm', weight: 'bold', color: WARNING_ORANGE, flex: 3 },
            ],
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: '💊 วิธีแก้ไข',
            size: 'sm',
            weight: 'bold',
            margin: 'md',
          },
          {
            type: 'text',
            text: '{{recommendation}}',
            size: 'sm',
            color: '#555555',
            wrap: true,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: 'ถามเพิ่มเติม', text: 'อยากรู้เพิ่มเติมเกี่ยวกับ {{diagnosis}}' },
            style: 'primary',
            color: LINE_GREEN,
            height: 'sm',
          },
        ],
      },
    },
  },

  // 2. Severity Alert (High Risk)
  {
    name: 'agrispark-severity-alert',
    description: 'แจ้งเตือนระดับวิกฤต — สำหรับโรคพืชหรือแมลงระดับสูง',
    category: 'agriculture',
    tags: ['alert', 'severity', 'high-risk', 'agrispark'],
    altText: '⚠️ แจ้งเตือนระดับวิกฤต',
    flexPayload: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: DANGER_RED,
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: '🚨 แจ้งเตือนระดับวิกฤต',
            color: '#FFFFFF',
            size: 'lg',
            weight: 'bold',
          },
          {
            type: 'text',
            text: '{{crop_name}} — ต้องดำเนินการทันที',
            color: '#FFCCCC',
            size: 'sm',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: '{{problem}}',
            size: 'md',
            weight: 'bold',
            wrap: true,
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: '⚡ การดำเนินการเร่งด่วน',
            size: 'sm',
            weight: 'bold',
            color: DANGER_RED,
            margin: 'md',
          },
          {
            type: 'text',
            text: '{{immediate_action}}',
            size: 'sm',
            wrap: true,
            color: '#333333',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: 'ติดต่อเจ้าหน้าที่', text: 'ต้องการติดต่อเจ้าหน้าที่เกษตร' },
            style: 'primary',
            color: DANGER_RED,
            height: 'sm',
          },
        ],
      },
    },
  },

  // 3. Weather Risk Summary
  {
    name: 'agrispark-weather-risk',
    description: 'สรุปความเสี่ยงสภาพอากาศสำหรับเกษตรกร',
    category: 'agriculture',
    tags: ['weather', 'risk', 'forecast', 'agrispark'],
    altText: '🌤️ สรุปสภาพอากาศและความเสี่ยง',
    flexPayload: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'horizontal',
        backgroundColor: INFO_BLUE,
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            flex: 1,
            contents: [
              { type: 'text', text: '🌤️ สภาพอากาศวันนี้', color: '#FFFFFF', size: 'md', weight: 'bold' },
              { type: 'text', text: '{{location}}', color: '#CCDDFF', size: 'sm', margin: 'xs' },
            ],
          },
          {
            type: 'text',
            text: '{{temperature}}°C',
            color: '#FFFFFF',
            size: 'xxl',
            weight: 'bold',
            align: 'end',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '💧 ความชื้น', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '{{humidity}}%', size: 'sm', weight: 'bold', flex: 3 },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '🌧️ ฝน', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '{{rain_chance}}% โอกาสฝน', size: 'sm', weight: 'bold', flex: 3 },
            ],
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: '🚜 คำแนะนำสำหรับเกษตรกร',
            size: 'sm',
            weight: 'bold',
            margin: 'md',
          },
          {
            type: 'text',
            text: '{{farm_advice}}',
            size: 'sm',
            wrap: true,
            color: '#555555',
          },
        ],
      },
    },
  },

  // 4. Flood/Storm Alert
  {
    name: 'agrispark-flood-alert',
    description: 'แจ้งเตือนน้ำท่วม/พายุระดับสูง',
    category: 'agriculture',
    tags: ['flood', 'storm', 'alert', 'weather', 'agrispark'],
    altText: '🌊 แจ้งเตือนน้ำท่วม/พายุ',
    flexPayload: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1A237E',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '🌊 แจ้งเตือนฉุกเฉิน', color: '#FFFFFF', size: 'lg', weight: 'bold' },
          { type: 'text', text: '{{alert_type}} — {{area}}', color: '#B3C5FF', size: 'sm', margin: 'xs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '{{description}}', size: 'sm', wrap: true, color: '#333333' },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: '🛡️ สิ่งที่ต้องทำ', size: 'sm', weight: 'bold', margin: 'md', color: DANGER_RED },
          { type: 'text', text: '{{protective_action}}', size: 'sm', wrap: true, color: '#555555' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: 'รายงานสถานการณ์', text: 'รายงานสถานการณ์น้ำท่วมในพื้นที่ของฉัน' },
            style: 'primary',
            color: '#1A237E',
            height: 'sm',
          },
        ],
      },
    },
  },

  // 5. Log Confirmation (with postback buttons)
  {
    name: 'agrispark-log-confirm',
    description: 'ยืนยันการบันทึกกิจกรรมเกษตร ก่อนบันทึกจริง',
    category: 'agriculture',
    tags: ['log', 'activity', 'confirm', 'agrispark'],
    altText: '📋 ยืนยันการบันทึกกิจกรรม',
    flexPayload: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '📋 ยืนยันการบันทึก?', size: 'lg', weight: 'bold' },
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'กิจกรรม', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '{{activity}}', size: 'sm', weight: 'bold', flex: 3, wrap: true },
            ],
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'แปลง', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '{{plot}}', size: 'sm', weight: 'bold', flex: 3 },
            ],
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'วันที่', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '{{date}}', size: 'sm', weight: 'bold', flex: 3 },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        paddingAll: '12px',
        contents: [
          {
            type: 'button',
            action: { type: 'postback', label: 'ยืนยัน ✓', data: 'action=confirm_log&id={{log_id}}' },
            style: 'primary',
            color: LINE_GREEN,
            flex: 1,
            height: 'sm',
          },
          {
            type: 'button',
            action: { type: 'message', label: 'ยกเลิก', text: 'ยกเลิกการบันทึก' },
            style: 'secondary',
            flex: 1,
            height: 'sm',
          },
        ],
      },
    },
  },

  // 6. Weekly Activity Summary
  {
    name: 'agrispark-weekly-summary',
    description: 'สรุปกิจกรรมเกษตรประจำสัปดาห์',
    category: 'agriculture',
    tags: ['summary', 'weekly', 'records', 'agrispark'],
    altText: '📊 สรุปกิจกรรมประจำสัปดาห์',
    flexPayload: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: LINE_GREEN,
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '📊 สรุปประจำสัปดาห์', color: '#FFFFFF', size: 'lg', weight: 'bold' },
          { type: 'text', text: '{{week_range}}', color: '#CCFFE8', size: 'sm', margin: 'xs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'กิจกรรมทั้งหมด', size: 'sm', color: '#888888', flex: 3 },
              { type: 'text', text: '{{total_activities}} ครั้ง', size: 'sm', weight: 'bold', flex: 2, align: 'end' },
            ],
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ค่าใช้จ่าย', size: 'sm', color: '#888888', flex: 3 },
              { type: 'text', text: '฿{{total_cost}}', size: 'sm', weight: 'bold', flex: 2, align: 'end' },
            ],
          },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: '📝 กิจกรรมสำคัญ', size: 'sm', weight: 'bold', margin: 'md' },
          { type: 'text', text: '{{highlight}}', size: 'sm', wrap: true, color: '#555555' },
        ],
      },
    },
  },

  // 7. Crop Price Check
  {
    name: 'agrispark-price-check',
    description: 'ตรวจสอบราคาพืชผลตลาดปัจจุบัน',
    category: 'agriculture',
    tags: ['price', 'market', 'crop', 'agrispark'],
    altText: '💰 ราคาพืชผลวันนี้',
    flexPayload: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'horizontal',
        backgroundColor: '#2E7D32',
        paddingAll: '16px',
        contents: [
          {
            type: 'box', layout: 'vertical', flex: 1,
            contents: [
              { type: 'text', text: '💰 ราคาตลาดวันนี้', color: '#FFFFFF', size: 'md', weight: 'bold' },
              { type: 'text', text: '{{crop_name}}', color: '#CCFFE8', size: 'sm', margin: 'xs' },
            ],
          },
          {
            type: 'box', layout: 'vertical', align: 'end',
            contents: [
              { type: 'text', text: '฿{{price}}/{{unit}}', color: '#FFFFFF', size: 'xl', weight: 'bold', align: 'end' },
              { type: 'text', text: '{{change}}', color: '#CCFFE8', size: 'xs', align: 'end' },
            ],
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ตลาด', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '{{market}}', size: 'sm', weight: 'bold', flex: 3 },
            ],
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'อัปเดต', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '{{updated_at}}', size: 'sm', flex: 3 },
            ],
          },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: '📈 แนวโน้ม: {{trend}}', size: 'sm', wrap: true, color: '#555555', margin: 'md' },
        ],
      },
    },
  },

  // 8. Sell vs Hold Decision Frame
  {
    name: 'agrispark-sell-decision',
    description: 'กรอบตัดสินใจ ขายหรือเก็บรักษาพืชผล',
    category: 'agriculture',
    tags: ['sell', 'decision', 'market', 'agrispark'],
    altText: '🤔 ขายหรือเก็บไว้?',
    flexPayload: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '🤔 ขายหรือเก็บไว้?', size: 'lg', weight: 'bold' },
          { type: 'text', text: '{{crop_name}} — {{quantity}} {{unit}}', size: 'sm', color: '#888888' },
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'horizontal', spacing: 'md',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1,
                backgroundColor: '#E8F5E9', cornerRadius: '8px', paddingAll: '12px',
                contents: [
                  { type: 'text', text: '✅ ขายเลย', weight: 'bold', size: 'sm', color: SUCCESS_GREEN },
                  { type: 'text', text: '{{sell_reason}}', size: 'xs', wrap: true, color: '#555555', margin: 'sm' },
                ],
              },
              {
                type: 'box', layout: 'vertical', flex: 1,
                backgroundColor: '#FFF8E1', cornerRadius: '8px', paddingAll: '12px',
                contents: [
                  { type: 'text', text: '⏳ รอก่อน', weight: 'bold', size: 'sm', color: WARNING_ORANGE },
                  { type: 'text', text: '{{wait_reason}}', size: 'xs', wrap: true, color: '#555555', margin: 'sm' },
                ],
              },
            ],
          },
          { type: 'text', text: '💡 {{recommendation}}', size: 'sm', wrap: true, color: INFO_BLUE, margin: 'md' },
        ],
      },
    },
  },

  // 9. Diagnosis with Photo (hero image)
  {
    name: 'agrispark-photo-diagnosis',
    description: 'ผลวินิจฉัยโรคพืชพร้อมรูปภาพตัวอย่าง',
    category: 'agriculture',
    tags: ['diagnosis', 'photo', 'pest', 'agrispark'],
    altText: '📸 ผลการวินิจฉัยจากภาพถ่าย',
    flexPayload: {
      type: 'bubble',
      size: 'mega',
      hero: {
        type: 'image',
        url: '{{image_url}}',
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '📸 ผลการวินิจฉัยจากภาพ', size: 'md', weight: 'bold' },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'วินิจฉัย', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '{{diagnosis}}', size: 'sm', weight: 'bold', flex: 3, wrap: true },
            ],
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ความน่าจะเป็น', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '{{confidence}}%', size: 'sm', weight: 'bold', color: LINE_GREEN, flex: 3 },
            ],
          },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: '{{recommendation}}', size: 'sm', wrap: true, color: '#555555' },
        ],
      },
    },
  },

  // 10. 7-Day Forecast (Carousel)
  {
    name: 'agrispark-7day-forecast',
    description: 'พยากรณ์อากาศ 7 วัน แบบ carousel',
    category: 'agriculture',
    tags: ['weather', 'forecast', '7-day', 'carousel', 'agrispark'],
    altText: '🌦️ พยากรณ์อากาศ 7 วัน',
    flexPayload: {
      type: 'carousel',
      contents: [
        {
          type: 'bubble',
          size: 'micro',
          header: {
            type: 'box', layout: 'vertical', backgroundColor: INFO_BLUE, paddingAll: '12px',
            contents: [{ type: 'text', text: 'วันจันทร์', color: '#FFFFFF', size: 'sm', weight: 'bold', align: 'center' }],
          },
          body: {
            type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm',
            contents: [
              { type: 'text', text: '⛅', size: 'xxl', align: 'center' },
              { type: 'text', text: '32°C', size: 'md', weight: 'bold', align: 'center' },
              { type: 'text', text: '🌧️ 40%', size: 'xs', color: '#888888', align: 'center' },
            ],
          },
        },
        {
          type: 'bubble',
          size: 'micro',
          header: {
            type: 'box', layout: 'vertical', backgroundColor: INFO_BLUE, paddingAll: '12px',
            contents: [{ type: 'text', text: 'วันอังคาร', color: '#FFFFFF', size: 'sm', weight: 'bold', align: 'center' }],
          },
          body: {
            type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm',
            contents: [
              { type: 'text', text: '🌤️', size: 'xxl', align: 'center' },
              { type: 'text', text: '30°C', size: 'md', weight: 'bold', align: 'center' },
              { type: 'text', text: '🌧️ 20%', size: 'xs', color: '#888888', align: 'center' },
            ],
          },
        },
        {
          type: 'bubble',
          size: 'micro',
          header: {
            type: 'box', layout: 'vertical', backgroundColor: INFO_BLUE, paddingAll: '12px',
            contents: [{ type: 'text', text: 'วันพุธ', color: '#FFFFFF', size: 'sm', weight: 'bold', align: 'center' }],
          },
          body: {
            type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm',
            contents: [
              { type: 'text', text: '🌧️', size: 'xxl', align: 'center' },
              { type: 'text', text: '28°C', size: 'md', weight: 'bold', align: 'center' },
              { type: 'text', text: '🌧️ 80%', size: 'xs', color: '#888888', align: 'center' },
            ],
          },
        },
      ],
    },
  },

  // 11. Main Menu (Postback-based)
  {
    name: 'agrispark-main-menu',
    description: 'เมนูหลักสำหรับระบบ AgriSpark',
    category: 'agriculture',
    tags: ['menu', 'main', 'navigation', 'agrispark'],
    altText: '🌾 เมนูหลัก AgriSpark',
    flexPayload: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: LINE_GREEN, paddingAll: '16px',
        contents: [
          { type: 'text', text: '🌾 AgriSpark', color: '#FFFFFF', size: 'xl', weight: 'bold' },
          { type: 'text', text: 'ผู้ช่วยอัจฉริยะสำหรับเกษตรกรไทย', color: '#CCFFE8', size: 'xs' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: '🔍 วินิจฉัยโรคพืช', text: 'ช่วยวินิจฉัยโรคพืชของฉัน' },
            style: 'secondary', height: 'sm',
          },
          {
            type: 'button',
            action: { type: 'message', label: '🌦️ พยากรณ์อากาศ', text: 'สภาพอากาศวันนี้' },
            style: 'secondary', height: 'sm',
          },
          {
            type: 'button',
            action: { type: 'message', label: '💰 ราคาตลาด', text: 'ราคาพืชผลวันนี้' },
            style: 'secondary', height: 'sm',
          },
          {
            type: 'button',
            action: { type: 'message', label: '📋 บันทึกกิจกรรม', text: 'บันทึกกิจกรรมเกษตร' },
            style: 'secondary', height: 'sm',
          },
        ],
      },
    },
  },

  // 12. Record Entry
  {
    name: 'agrispark-record-entry',
    description: 'แสดงรายการกิจกรรมที่บันทึกสำเร็จ',
    category: 'agriculture',
    tags: ['record', 'log', 'entry', 'agrispark'],
    altText: '✅ บันทึกกิจกรรมสำเร็จ',
    flexPayload: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
        contents: [
          { type: 'text', text: '✅ บันทึกสำเร็จ', size: 'lg', weight: 'bold', color: SUCCESS_GREEN },
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'กิจกรรม', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '{{activity}}', size: 'sm', weight: 'bold', flex: 3, wrap: true },
            ],
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'แปลง', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '{{plot}}', size: 'sm', weight: 'bold', flex: 3 },
            ],
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'วันที่', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '{{date}}', size: 'sm', flex: 3 },
            ],
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ค่าใช้จ่าย', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '฿{{cost}}', size: 'sm', weight: 'bold', flex: 3 },
            ],
          },
        ],
      },
    },
  },

  // 13. Officer Broadcast (for extension officers)
  {
    name: 'agrispark-officer-broadcast',
    description: 'ประกาศจากเจ้าหน้าที่เกษตรถึงเกษตรกรในพื้นที่',
    category: 'agriculture',
    tags: ['broadcast', 'officer', 'announcement', 'agrispark'],
    altText: '📢 ประกาศจากเจ้าหน้าที่เกษตร',
    flexPayload: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: WARNING_ORANGE, paddingAll: '16px',
        contents: [
          { type: 'text', text: '📢 ประกาศจากเจ้าหน้าที่เกษตร', color: '#FFFFFF', size: 'md', weight: 'bold' },
          { type: 'text', text: '{{area}} — {{crop}}', color: '#FFE0B2', size: 'sm', margin: 'xs' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
        contents: [
          { type: 'text', text: '{{title}}', size: 'md', weight: 'bold', wrap: true },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: '{{description}}', size: 'sm', wrap: true, color: '#333333' },
          { type: 'separator', margin: 'md' },
          {
            type: 'text', text: '✅ คำแนะนำที่แนะนำ',
            size: 'sm', weight: 'bold', margin: 'md', color: SUCCESS_GREEN,
          },
          { type: 'text', text: '{{recommended_action}}', size: 'sm', wrap: true, color: '#555555' },
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: '👤 {{officer_name}}', size: 'xs', color: '#888888', flex: 3 },
              { type: 'text', text: '{{issued_date}}', size: 'xs', color: '#888888', flex: 2, align: 'end' },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: '📞 ติดต่อเจ้าหน้าที่', uri: 'tel:{{officer_tel}}' },
            style: 'primary', color: WARNING_ORANGE, height: 'sm',
          },
        ],
      },
    },
  },
];
