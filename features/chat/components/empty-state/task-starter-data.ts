import type { AgentStarterTask } from './types';

type StarterSource = {
  agentName?: string | null;
  agentDescription?: string | null;
  starterTasks?: AgentStarterTask[];
  generalStarterPrompts?: string[];
};

const marketingTasks: AgentStarterTask[] = [
  {
    id: 'marketing-broadcast-launch',
    title: 'เขียน Broadcast เปิดตัวสินค้าใหม่',
    description: 'ร่างข้อความ LINE OA สำหรับเปิดตัวสินค้าใหม่พร้อม CTA',
    prompt:
      'ช่วยเขียน LINE OA Broadcast สำหรับเปิดตัวสินค้าใหม่ ชื่อสินค้า: [ใส่ชื่อสินค้า] กลุ่มลูกค้า: [ใส่กลุ่มลูกค้า] จุดขายหลัก: [ใส่จุดขาย] โทนภาษา: เป็นกันเองและชวนซื้อ',
    icon: 'message',
    priority: 'primary',
  },
  {
    id: 'marketing-calendar-30-days',
    title: 'วางแผน Content Calendar 30 วัน',
    description: 'จัดหัวข้อโพสต์สำหรับ LINE OA, Facebook และ Instagram',
    prompt:
      'ช่วยวางแผน Content Calendar 30 วัน สำหรับธุรกิจ [ประเภทธุรกิจ] โดยใช้ช่องทาง LINE OA, Facebook และ Instagram พร้อมหัวข้อโพสต์ เป้าหมาย และ CTA ในแต่ละวัน',
    icon: 'calendar',
    priority: 'primary',
  },
  {
    id: 'marketing-social-captions',
    title: 'สร้าง Caption Facebook / Instagram',
    description: 'เขียน caption หลายแบบพร้อม hashtag และ CTA',
    prompt:
      'ช่วยเขียน caption สำหรับ Facebook และ Instagram จำนวน 5 แบบ สำหรับสินค้า/บริการ [รายละเอียด] โดยมี hashtag และ CTA ที่เหมาะกับลูกค้าไทย',
    icon: 'edit',
    priority: 'primary',
  },
  {
    id: 'marketing-promo-campaign',
    title: 'ทำแคมเปญโปรโมชัน 7 วัน',
    description: 'ออกแบบข้อความรายวันสำหรับโปรโมชันระยะสั้น',
    prompt:
      'ช่วยออกแบบแคมเปญโปรโมชัน 7 วัน สำหรับ [สินค้า/บริการ] โดยมีข้อความรายวันสำหรับ LINE OA และโพสต์ social พร้อมข้อเสนอและ CTA',
    icon: 'sparkles',
    priority: 'primary',
  },
  {
    id: 'marketing-competitor-analysis',
    title: 'วิเคราะห์คอนเทนต์คู่แข่ง',
    description: 'สรุปแนวทางคู่แข่งและหาโอกาสที่เราควรใช้',
    prompt:
      'ช่วยวิเคราะห์คอนเทนต์ของคู่แข่งในธุรกิจ [ประเภทธุรกิจ] ว่าพวกเขาเน้นอะไร จุดเด่นคืออะไร และเราควรทำคอนเทนต์ต่างอย่างไร',
    icon: 'search',
    priority: 'secondary',
  },
  {
    id: 'marketing-repurpose',
    title: 'แปลงโพสต์เก่าเป็นหลายช่องทาง',
    description: 'นำคอนเทนต์เดิมไปใช้ต่อในหลายรูปแบบ',
    prompt:
      'ช่วยแปลงคอนเทนต์นี้ให้เป็น 1) LINE OA message 2) Facebook post 3) Instagram caption 4) short video script โดยรักษาใจความเดิมแต่ให้เหมาะกับแต่ละช่องทาง',
    icon: 'refresh',
    priority: 'secondary',
  },
  {
    id: 'marketing-email-newsletter',
    title: 'ทำ Email Newsletter',
    description: 'ร่างอีเมลประชาสัมพันธ์ที่ชัดและชวนอ่าน',
    prompt:
      'ช่วยร่าง Email Newsletter สำหรับ [สินค้า/บริการหรือข่าวสาร] โดยมีหัวเรื่อง เนื้อหาแบบกระชับ และ CTA ที่ชัดเจน',
    icon: 'mail',
    priority: 'secondary',
  },
  {
    id: 'marketing-landing-page',
    title: 'เขียน Landing Page Copy',
    description: 'สรุปจุดขายและ CTA สำหรับหน้าโปรโมต',
    prompt:
      'ช่วยเขียน Landing Page Copy สำหรับ [สินค้า/บริการ] โดยมี headline, subheadline, key benefits, proof points และ CTA',
    icon: 'edit',
    priority: 'secondary',
  },
];

const lineTasks: AgentStarterTask[] = [
  {
    id: 'line-reply-price-delivery',
    title: 'ตอบแชตลูกค้าเรื่องราคาและจัดส่ง',
    description: 'ร่างข้อความตอบลูกค้าให้สุภาพและปิดการขายง่าย',
    prompt:
      'ช่วยร่างข้อความตอบลูกค้าใน LINE เรื่องราคา วิธีสั่งซื้อ และการจัดส่ง สำหรับสินค้า [รายละเอียดสินค้า] โดยใช้โทนสุภาพและปิดการขายแบบไม่กดดัน',
    icon: 'message',
    priority: 'primary',
  },
  {
    id: 'line-broadcast-draft',
    title: 'ร่าง Broadcast แจ้งโปรโมชัน',
    description: 'เตรียมข้อความบรอดแคสต์สำหรับโปรโมชันหรือข่าวใหม่',
    prompt:
      'ช่วยร่าง LINE OA Broadcast เพื่อแจ้งโปรโมชัน [รายละเอียดโปรโมชัน] สำหรับลูกค้ากลุ่ม [กลุ่มลูกค้า] โดยมีหัวเปิด เนื้อหาหลัก และ CTA',
    icon: 'mail',
    priority: 'primary',
  },
  {
    id: 'line-rich-menu-plan',
    title: 'ออกแบบ Rich Menu',
    description: 'ช่วยคิดเมนูหลักและการจัดวางสำหรับลูกค้า',
    prompt:
      'ช่วยออกแบบ Rich Menu สำหรับ LINE OA ของธุรกิจ [ประเภทธุรกิจ] โดยแนะนำปุ่มหลัก ข้อความบนปุ่ม และเหตุผลว่าทำไมลูกค้าควรเห็นเมนูนี้ก่อน',
    icon: 'sparkles',
    priority: 'primary',
  },
  {
    id: 'line-segmentation',
    title: 'แบ่งกลุ่มลูกค้าสำหรับ Broadcast',
    description: 'กำหนด segment ที่เหมาะกับข้อความแต่ละแบบ',
    prompt:
      'ช่วยแบ่งกลุ่มลูกค้าสำหรับส่ง LINE OA Broadcast ของธุรกิจ [ประเภทธุรกิจ] พร้อมตัวอย่างข้อความที่เหมาะกับแต่ละ segment',
    icon: 'chart',
    priority: 'primary',
  },
  {
    id: 'line-welcome-message',
    title: 'เขียนข้อความต้อนรับเพื่อนใหม่',
    description: 'ทำ welcome flow แรกให้ชัดและเป็นมิตร',
    prompt:
      'ช่วยเขียนข้อความต้อนรับเพื่อนใหม่ใน LINE OA สำหรับธุรกิจ [ประเภทธุรกิจ] โดยมีข้อความแนะนำสั้น ๆ สิทธิพิเศษแรกเข้า และ CTA',
    icon: 'message',
    priority: 'secondary',
  },
  {
    id: 'line-faq',
    title: 'ทำ FAQ สำหรับแอดมิน',
    description: 'รวบรวมคำถามที่เจอบ่อยและคำตอบพร้อมใช้',
    prompt:
      'ช่วยสร้าง FAQ สำหรับแอดมิน LINE OA ของธุรกิจ [ประเภทธุรกิจ] โดยสรุปคำถามที่ลูกค้าถามบ่อยและคำตอบแบบพร้อมส่ง',
    icon: 'edit',
    priority: 'secondary',
  },
];

const researchTasks: AgentStarterTask[] = [
  {
    id: 'research-summary',
    title: 'สรุปเอกสารเป็นข้อเสนอ',
    description: 'ดึงสาระสำคัญและเรียบเรียงเป็นข้อเสนออ่านง่าย',
    prompt:
      'ช่วยสรุปเอกสารหรือข้อมูลนี้ให้เป็นข้อเสนอสำหรับผู้บริหาร โดยแยกเป็นภาพรวม ประเด็นสำคัญ ความเสี่ยง และข้อเสนอแนะ',
    icon: 'edit',
    priority: 'primary',
  },
  {
    id: 'research-competitors',
    title: 'ค้นคว้าคู่แข่งพร้อมแหล่งอ้างอิง',
    description: 'รวบรวมคู่แข่ง จุดเด่น และอ้างอิงแหล่งข้อมูล',
    prompt:
      'ช่วยค้นคว้าคู่แข่งในตลาด [ชื่อตลาดหรืออุตสาหกรรม] พร้อมสรุปจุดเด่น จุดอ่อน และแนบแหล่งอ้างอิงที่ใช้ประกอบ',
    icon: 'search',
    priority: 'primary',
  },
  {
    id: 'research-market-scan',
    title: 'ทำ Market Scan',
    description: 'สำรวจภาพรวมตลาด กลุ่มลูกค้า และแนวโน้มสำคัญ',
    prompt:
      'ช่วยทำ Market Scan สำหรับ [สินค้า/บริการ] โดยสรุปกลุ่มลูกค้า แนวโน้มตลาด โอกาส และความเสี่ยงที่ควรระวัง',
    icon: 'chart',
    priority: 'primary',
  },
  {
    id: 'research-compare-options',
    title: 'เปรียบเทียบตัวเลือกพร้อมข้อดีข้อเสีย',
    description: 'จัดทางเลือกเป็นตารางตัดสินใจที่อ่านง่าย',
    prompt:
      'ช่วยเปรียบเทียบตัวเลือกต่อไปนี้ [ใส่ตัวเลือก] พร้อมข้อดี ข้อเสีย ความเหมาะสม และข้อเสนอแนะว่าควรเลือกแบบไหนในบริบทนี้',
    icon: 'sparkles',
    priority: 'primary',
  },
  {
    id: 'research-executive-summary',
    title: 'ทำ Executive Summary',
    description: 'สรุปให้ผู้บริหารอ่านได้เร็วและตัดสินใจง่าย',
    prompt:
      'ช่วยเขียน Executive Summary จากข้อมูลนี้ โดยเน้นสิ่งที่ผู้บริหารต้องรู้ทันทีและข้อเสนอแนะที่ควรตัดสินใจต่อ',
    icon: 'edit',
    priority: 'secondary',
  },
  {
    id: 'research-action-items',
    title: 'ดึง Action Items จากเอกสาร',
    description: 'แยกงานที่ต้องทำต่อพร้อมเจ้าของและลำดับความสำคัญ',
    prompt:
      'ช่วยดึง Action Items จากเอกสารนี้ พร้อมจัดลำดับความสำคัญ ระบุผู้รับผิดชอบที่เหมาะสม และกำหนด next steps',
    icon: 'calendar',
    priority: 'secondary',
  },
];

const generalAssistantTasks: AgentStarterTask[] = [
  {
    id: 'general-english-email',
    title: 'ร่างอีเมลภาษาอังกฤษ',
    description: 'ช่วยเขียนอีเมลให้พร้อมส่งในโทนที่เหมาะกับงาน',
    prompt:
      'ช่วยร่างอีเมลภาษาอังกฤษให้หน่อย เรื่อง [หัวข้อ] ถึง [ผู้รับ] โดยใช้โทน [ทางการ/เป็นกันเอง] และสรุปสิ่งที่อยากให้เขาดำเนินการต่อ',
    icon: 'mail',
    priority: 'primary',
  },
  {
    id: 'general-document-summary',
    title: 'สรุปเอกสารให้พร้อมใช้ต่อ',
    description: 'สกัดประเด็นสำคัญ งานที่ต้องทำ และคำถามค้าง',
    prompt:
      'ช่วยสรุปเอกสารนี้ให้หน่อย โดยแยกเป็นภาพรวม ประเด็นสำคัญ สิ่งที่ต้องทำต่อ และคำถามที่ยังต้องหาข้อมูลเพิ่ม',
    icon: 'chart',
    priority: 'primary',
  },
  {
    id: 'general-translate-thai',
    title: 'แปลข้อความเป็นภาษาไทย',
    description: 'แปลให้อ่านลื่นและเหมาะกับบริบทงานจริง',
    prompt:
      'ช่วยแปลข้อความนี้เป็นภาษาไทย โดยรักษาความหมายเดิมและปรับสำนวนให้เป็นธรรมชาติสำหรับการใช้งานจริง',
    icon: 'refresh',
    priority: 'primary',
  },
  {
    id: 'general-latest-research',
    title: 'ค้นหาข้อมูลล่าสุดแล้วสรุป',
    description: 'ใช้โหมดค้นคว้าเพื่อหาข้อเท็จจริงล่าสุดพร้อมสรุป',
    prompt:
      'ค้นหาข้อมูลล่าสุดเกี่ยวกับ [หัวข้อ] แล้วสรุปให้หน่อย โดยแยกเป็นสิ่งที่เกิดขึ้นล่าสุด ผลกระทบ และสิ่งที่ควรจับตาต่อ',
    icon: 'search',
    priority: 'primary',
  },
  {
    id: 'general-line-reply',
    title: 'ร่างข้อความตอบลูกค้า LINE',
    description: 'ช่วยตอบให้สุภาพ ชัด และปิดประเด็นได้',
    prompt:
      'ช่วยร่างข้อความตอบลูกค้าใน LINE เรื่อง [คำถามหรือปัญหา] โดยใช้โทนสุภาพ กระชับ และมี next step ชัดเจน',
    icon: 'message',
    priority: 'secondary',
  },
  {
    id: 'general-weekly-plan',
    title: 'จัดแผนงานสัปดาห์นี้',
    description: 'จัดลำดับงานจากรายการที่มีอยู่ให้ทำต่อได้เลย',
    prompt:
      'ช่วยจัดแผนงานสัปดาห์นี้จากรายการต่อไปนี้ [รายการงาน] โดยเรียงลำดับความสำคัญ แนะนำ deadline และระบุสิ่งที่ควรเริ่มก่อน',
    icon: 'calendar',
    priority: 'secondary',
  },
];

const supportTasks: AgentStarterTask[] = [
  {
    id: 'support-price-question',
    title: 'ตอบคำถามเรื่องราคาสินค้า',
    description: 'ร่างคำตอบที่ชัด สุภาพ และชวนคุยต่อ',
    prompt:
      'ช่วยร่างข้อความตอบลูกค้าที่สอบถามเรื่องราคาสินค้า [ชื่อสินค้า] โดยให้ข้อมูลชัดเจน สุภาพ และชวนให้ลูกค้าถามต่อหรือสั่งซื้อได้ง่าย',
    icon: 'message',
    priority: 'primary',
  },
  {
    id: 'support-contact-team',
    title: 'รับเรื่องและส่งต่อทีมงาน',
    description: 'ตอบลูกค้าให้อุ่นใจพร้อมขอข้อมูลที่จำเป็น',
    prompt:
      'ช่วยร่างข้อความตอบลูกค้าที่ต้องการติดต่อทีมงานเรื่อง [หัวข้อ] โดยสรุปว่าทีมจะช่วยอะไรได้บ้าง และขอข้อมูลที่จำเป็นเพื่อส่งต่อ',
    icon: 'mail',
    priority: 'primary',
  },
  {
    id: 'support-opening-hours',
    title: 'ตอบเรื่องเวลาเปิด-ปิด',
    description: 'ให้ข้อมูลเวลาให้ครบพร้อมชวนดำเนินการต่อ',
    prompt:
      'ช่วยร่างข้อความตอบลูกค้าที่ถามเรื่องเวลาเปิด-ปิดของร้าน/บริการ โดยระบุช่วงเวลา ช่องทางติดต่อ และสิ่งที่ลูกค้าทำต่อได้',
    icon: 'calendar',
    priority: 'primary',
  },
  {
    id: 'support-order-problem',
    title: 'รับมือปัญหาการสั่งซื้อ',
    description: 'ตอบอย่างใจเย็นและเก็บข้อมูลเพื่อติดตามต่อ',
    prompt:
      'ช่วยร่างข้อความตอบลูกค้าที่มีปัญหาเรื่องการสั่งซื้อ [รายละเอียดปัญหา] โดยใช้โทนเห็นใจ สรุปสิ่งที่เราจะช่วย และขอข้อมูลสำหรับตรวจสอบต่อ',
    icon: 'sparkles',
    priority: 'primary',
  },
  {
    id: 'support-faq',
    title: 'สรุป FAQ พร้อมคำตอบพร้อมส่ง',
    description: 'รวมคำตอบมาตรฐานสำหรับแอดมินใช้งานต่อ',
    prompt:
      'ช่วยสรุป FAQ สำหรับธุรกิจ [ประเภทธุรกิจ] โดยรวมคำถามลูกค้าที่พบบ่อยและคำตอบแบบพร้อมส่งใน LINE',
    icon: 'edit',
    priority: 'secondary',
  },
  {
    id: 'support-escalation',
    title: 'ร่างข้อความขอเวลาตรวจสอบ',
    description: 'ตอบเมื่อต้องส่งต่อหรือรอทีมงานตรวจสอบ',
    prompt:
      'ช่วยร่างข้อความแจ้งลูกค้าว่ากำลังตรวจสอบเรื่อง [หัวข้อ] กับทีมงาน พร้อมบอกเวลาประมาณการตอบกลับและทำให้ลูกค้ารู้สึกอุ่นใจ',
    icon: 'refresh',
    priority: 'secondary',
  },
];

const salesAdminTasks: AgentStarterTask[] = [
  {
    id: 'sales-follow-up-quote',
    title: 'ติดตามใบเสนอราคาแบบสุภาพ',
    description: 'ส่ง follow-up ที่นุ่มนวลและมีเป้าหมายชัด',
    prompt:
      'ช่วยร่างข้อความติดตามใบเสนอราคาแบบสุภาพให้ลูกค้า [ชื่อลูกค้า] โดยอ้างอิงงานที่คุยกันไว้ สรุปประเด็นสั้น ๆ และปิดท้ายด้วย next step ที่นุ่มนวล',
    icon: 'message',
    priority: 'primary',
  },
  {
    id: 'sales-meeting-actions',
    title: 'สรุป action items จากประชุม',
    description: 'แยกงานต่อ เจ้าของงาน และกำหนดเวลาให้ชัด',
    prompt:
      'ช่วยสรุป action items จากการประชุมวันนี้ โดยแยกเป็นประเด็นสำคัญ ผู้รับผิดชอบ กำหนดเวลา และสิ่งที่ต้องติดตามต่อ',
    icon: 'calendar',
    priority: 'primary',
  },
  {
    id: 'sales-proposal-new-client',
    title: 'ร่าง proposal สำหรับลูกค้าใหม่',
    description: 'จัดโครงข้อเสนอให้ครบตั้งแต่ปัญหาถึง next step',
    prompt:
      'ช่วยร่าง proposal สำหรับลูกค้าใหม่ [ประเภทธุรกิจลูกค้า] โดยใช้โครง ปัญหา > แนวทางแก้ > ขอบเขตงาน > ราคา > next step และเขียนเป็นภาษาไทยที่มืออาชีพ',
    icon: 'edit',
    priority: 'primary',
  },
  {
    id: 'sales-log-activity',
    title: 'บันทึกกิจกรรมการขายวันนี้',
    description: 'สรุปเป็นบันทึกที่ค้นต่อและใช้งานต่อได้ง่าย',
    prompt:
      'ช่วยสรุปกิจกรรมการขายวันนี้เป็นบันทึก โดยระบุลูกค้า สิ่งที่คุย ผลลัพธ์ โอกาสถัดไป และรายการที่ควรติดตามต่อ',
    icon: 'chart',
    priority: 'primary',
  },
  {
    id: 'sales-objection-reply',
    title: 'ตอบข้อกังวลของลูกค้า',
    description: 'ช่วยตอบแบบไม่กดดันและยังพาไปต่อได้',
    prompt:
      'ช่วยร่างข้อความตอบข้อกังวลของลูกค้าเรื่อง [ข้อกังวล] โดยรับฟังอย่างสุภาพ อธิบายให้ชัด และเสนอทางเลือกถัดไปโดยไม่กดดัน',
    icon: 'sparkles',
    priority: 'secondary',
  },
  {
    id: 'sales-summary-email',
    title: 'ร่างอีเมลสรุปหลังประชุม',
    description: 'ส่ง recap ที่พร้อมใช้งานกับลูกค้าหรือทีม',
    prompt:
      'ช่วยร่างอีเมลสรุปหลังประชุมให้ [ผู้รับ] โดยสรุปสิ่งที่ตกลงกัน action items และกำหนดการติดตามครั้งถัดไป',
    icon: 'mail',
    priority: 'secondary',
  },
];

const writingTasks: AgentStarterTask[] = [
  {
    id: 'writing-meeting-email',
    title: 'เขียนอีเมลขอนัดประชุม',
    description: 'ร่างอีเมลพร้อมหัวเรื่องและถ้อยคำสุภาพ',
    prompt:
      'ช่วยเขียนอีเมลขอนัดประชุมกับลูกค้าเรื่อง [หัวข้อ] โดยมี subject line ที่ชัดเจน เนื้อหากระชับ และเสนอช่วงเวลานัดหมายที่เหมาะสม',
    icon: 'mail',
    priority: 'primary',
  },
  {
    id: 'writing-resignation-letter',
    title: 'ร่างจดหมายลาออกแบบสุภาพ',
    description: 'จัดข้อความให้ครบ สุภาพ และมืออาชีพ',
    prompt:
      'ช่วยร่างจดหมายลาออกแบบสุภาพ โดยระบุเหตุผลอย่างเหมาะสม วันที่มีผล และข้อความขอบคุณต่อองค์กร',
    icon: 'edit',
    priority: 'primary',
  },
  {
    id: 'writing-executive-summary',
    title: 'เขียน executive summary',
    description: 'สรุปรายงานให้ผู้อ่านตัดสินใจได้เร็วขึ้น',
    prompt:
      'ช่วยเขียน executive summary จากรายงานนี้ โดยสรุปภาพรวม ประเด็นสำคัญ ข้อค้นพบหลัก และข้อเสนอแนะในรูปแบบมืออาชีพ',
    icon: 'chart',
    priority: 'primary',
  },
  {
    id: 'writing-video-script',
    title: 'ร่างสคริปต์วิดีโอ 2 นาที',
    description: 'เขียนสคริปต์พร้อมลำดับการเล่าเรื่องที่ลื่น',
    prompt:
      'ช่วยร่างสคริปต์วิดีโอแนะนำบริษัทความยาวประมาณ 2 นาที โดยมี opening hook เนื้อหาหลัก จุดเด่นของบริษัท และ closing ที่ชวนให้ติดต่อ',
    icon: 'sparkles',
    priority: 'primary',
  },
  {
    id: 'writing-formal-letter',
    title: 'เขียนจดหมายหรือหนังสือทางการ',
    description: 'ช่วยปรับภาษาให้สุภาพและเป็นทางการถูกบริบท',
    prompt:
      'ช่วยร่างหนังสือทางการเรื่อง [หัวข้อ] ถึง [ผู้รับ] โดยใช้ภาษาไทยที่สุภาพ ชัดเจน และมีโครงสร้างเหมาะกับงานราชการหรือธุรกิจ',
    icon: 'message',
    priority: 'secondary',
  },
  {
    id: 'writing-slide-outline',
    title: 'จัดโครงสไลด์นำเสนอ',
    description: 'สรุปหัวข้อสไลด์ให้พร้อมไปทำ deck ต่อ',
    prompt:
      'ช่วยจัดโครงสไลด์นำเสนอเรื่อง [หัวข้อ] จำนวนประมาณ [จำนวน] สไลด์ โดยระบุหัวข้อแต่ละสไลด์และสาระสำคัญที่ควรอยู่ในแต่ละหน้า',
    icon: 'calendar',
    priority: 'secondary',
  },
];

const teacherTasks: AgentStarterTask[] = [
  {
    id: 'teacher-lesson-plan',
    title: 'สร้างแผนการสอน',
    description: 'จัดแผนการสอนให้ครบตามระดับชั้นและเวลาเรียน',
    prompt:
      'ช่วยสร้างแผนการสอนวิชา [วิชา] ระดับ [ชั้น] เรื่อง [หัวข้อ] โดยมีจุดประสงค์การเรียนรู้ กิจกรรม สื่อ และวิธีประเมินผล',
    icon: 'calendar',
    priority: 'primary',
  },
  {
    id: 'teacher-final-exam',
    title: 'สร้างข้อสอบพร้อมเฉลย',
    description: 'ออกข้อสอบให้เหมาะกับระดับและรูปแบบที่ต้องการ',
    prompt:
      'ช่วยสร้างข้อสอบวิชา [วิชา] ระดับ [ชั้น] จำนวน [จำนวนข้อ] ข้อ โดยมีเฉลยและคำอธิบายสั้น ๆ สำหรับครูตรวจ',
    icon: 'edit',
    priority: 'primary',
  },
  {
    id: 'teacher-worksheet',
    title: 'ทำ worksheet พร้อมใช้งาน',
    description: 'ออกใบงานที่นักเรียนทำต่อได้ทันที',
    prompt:
      'ช่วยทำ worksheet เรื่อง [หัวข้อ] สำหรับนักเรียนระดับ [ชั้น] โดยมีคำชี้แจง แบบฝึกหัด และคำตอบสำหรับครู',
    icon: 'sparkles',
    priority: 'primary',
  },
  {
    id: 'teacher-certificate',
    title: 'สร้างข้อความใบรับรอง',
    description: 'เตรียมข้อความสำหรับใบรับรองหรือประกาศนียบัตร',
    prompt:
      'ช่วยร่างข้อความใบรับรองการเข้าอบรม/เข้าร่วมกิจกรรม สำหรับ [ชื่อกิจกรรม] โดยมีชื่อผู้รับ วันที่ และข้อความรับรองที่เหมาะสม',
    icon: 'mail',
    priority: 'primary',
  },
  {
    id: 'teacher-rubric',
    title: 'ทำเกณฑ์ประเมินงาน',
    description: 'ช่วยจัด rubric ที่ตรวจง่ายและสื่อสารชัด',
    prompt:
      'ช่วยสร้าง rubric ประเมินงานเรื่อง [หัวข้อ] สำหรับระดับ [ชั้น] โดยแยกเกณฑ์ คะแนน และคำอธิบายแต่ละระดับให้ชัดเจน',
    icon: 'chart',
    priority: 'secondary',
  },
  {
    id: 'teacher-study-guide',
    title: 'สรุปบทเรียนเป็นคู่มือทบทวน',
    description: 'จัดเป็นสื่ออ่านทบทวนก่อนสอบสำหรับนักเรียน',
    prompt:
      'ช่วยสรุปบทเรียนเรื่อง [หัวข้อ] สำหรับนักเรียนระดับ [ชั้น] ให้เป็นคู่มือทบทวนก่อนสอบ โดยใช้ภาษาที่เข้าใจง่ายและมีตัวอย่างประกอบ',
    icon: 'message',
    priority: 'secondary',
  },
];

const farmTasks: AgentStarterTask[] = [
  {
    id: 'farm-diagnose-leaves',
    title: 'วิเคราะห์อาการใบพืชผิดปกติ',
    description: 'ช่วยไล่สาเหตุเบื้องต้นและแนวทางดูแลทันที',
    prompt:
      'ใบพืชเหลืองและมีจุดดำ เกิดจากอะไร? ช่วยวิเคราะห์สาเหตุที่เป็นไปได้ วิธีสังเกตเพิ่ม และแนวทางดูแลเบื้องต้นแบบใช้ได้จริงในไทย',
    icon: 'search',
    priority: 'primary',
  },
  {
    id: 'farm-cassava-price',
    title: 'เช็คราคาพืชผลวันนี้',
    description: 'สรุปราคาล่าสุดและสิ่งที่ควรจับตาในการขาย',
    prompt:
      'ช่วยเช็คราคามันสำปะหลังวันนี้ พร้อมสรุปแนวโน้มราคา ปัจจัยที่กระทบ และข้อควรพิจารณาก่อนขาย',
    icon: 'chart',
    priority: 'primary',
  },
  {
    id: 'farm-weather-planting',
    title: 'ประเมินอากาศกับการเพาะปลูก',
    description: 'ช่วยดูความเสี่ยงจากสภาพอากาศและช่วงเวลาปลูก',
    prompt:
      'อากาศช่วงนี้เหมาะปลูกอะไร? ช่วยประเมินจากสภาพอากาศ ปริมาณฝน และความเสี่ยงที่เกษตรกรควรระวังในพื้นที่ [พื้นที่]',
    icon: 'calendar',
    priority: 'primary',
  },
  {
    id: 'farm-log-harvest',
    title: 'สรุปและบันทึกการเก็บเกี่ยว',
    description: 'จัดข้อมูลเป็นบันทึกงานเกษตรที่ตามต่อได้ง่าย',
    prompt:
      'ช่วยสรุปการเก็บเกี่ยววันนี้เป็นบันทึก โดยระบุพืช ปริมาณ ผลผลิต คุณภาพ ปัญหาที่พบ และสิ่งที่ควรติดตามต่อ',
    icon: 'message',
    priority: 'primary',
  },
  {
    id: 'farm-prevention-plan',
    title: 'วางแผนป้องกันโรคและแมลง',
    description: 'ช่วยคิดแผนป้องกันก่อนเกิดปัญหาในแปลง',
    prompt:
      'ช่วยวางแผนป้องกันโรคและแมลงสำหรับ [พืช] ในช่วง [ระยะการปลูก] โดยเน้นวิธีป้องกันที่เกษตรกรไทยทำได้จริงและสิ่งที่ต้องเฝ้าระวัง',
    icon: 'sparkles',
    priority: 'secondary',
  },
  {
    id: 'farm-escalation',
    title: 'ประเมินความรุนแรงและควรขอผู้เชี่ยวชาญไหม',
    description: 'ช่วยตัดสินใจว่าเคสไหนควรรีบประสานเจ้าหน้าที่',
    prompt:
      'จากอาการต่อไปนี้ [อาการ] ช่วยประเมินความรุนแรง สิ่งที่ควรทำทันที และกรณีไหนควรรีบติดต่อเจ้าหน้าที่เกษตรหรือผู้เชี่ยวชาญ',
    icon: 'refresh',
    priority: 'secondary',
  },
];

const fallbackTasks: AgentStarterTask[] = [
  {
    id: 'general-reply-line',
    title: 'ช่วยตอบลูกค้า LINE',
    description: 'ร่างข้อความตอบลูกค้าให้ชัดและสุภาพ',
    prompt:
      'ช่วยร่างข้อความตอบลูกค้าใน LINE เรื่อง [ปัญหาหรือคำถาม] โดยใช้โทนสุภาพ เข้าใจง่าย และมีข้อเสนอแนะถัดไป',
    icon: 'message',
    priority: 'primary',
  },
  {
    id: 'general-content-ideas',
    title: 'วางไอเดียคอนเทนต์สัปดาห์นี้',
    description: 'คิดหัวข้อที่ทำได้จริงสำหรับงานสื่อสารประจำสัปดาห์',
    prompt:
      'ช่วยวางไอเดียคอนเทนต์สำหรับสัปดาห์นี้ของธุรกิจ [ประเภทธุรกิจ] โดยมีหัวข้อ จุดประสงค์ และช่องทางที่เหมาะสม',
    icon: 'calendar',
    priority: 'primary',
  },
  {
    id: 'general-summarize',
    title: 'สรุปไฟล์หรือข้อความ',
    description: 'สกัดใจความสำคัญให้พร้อมใช้ต่อทันที',
    prompt:
      'ช่วยสรุปข้อความหรือไฟล์นี้ให้กระชับ พร้อมแยกประเด็นสำคัญ สิ่งที่ต้องทำต่อ และคำถามที่ยังไม่มีคำตอบ',
    icon: 'edit',
    priority: 'primary',
  },
  {
    id: 'general-draft-message',
    title: 'ร่างข้อความส่งงาน',
    description: 'จัดข้อความให้พร้อมส่งลูกค้า ทีม หรือพาร์ตเนอร์',
    prompt:
      'ช่วยร่างข้อความส่งงานให้ [ผู้รับ] เรื่อง [หัวข้อ] โดยใช้โทน [ทางการ/เป็นกันเอง] และสรุปสาระสำคัญให้ครบ',
    icon: 'mail',
    priority: 'primary',
  },
];

const iconFromTitle = (title: string): AgentStarterTask['icon'] => {
  const value = title.toLowerCase();
  if (
    value.includes('calendar') ||
    value.includes('schedule') ||
    value.includes('meeting') ||
    value.includes('แผน') ||
    value.includes('นัด') ||
    value.includes('เก็บเกี่ยว')
  ) {
    return 'calendar';
  }
  if (
    value.includes('broadcast') ||
    value.includes('line') ||
    value.includes('reply') ||
    value.includes('chat') ||
    value.includes('แชต') ||
    value.includes('ลูกค้า')
  ) {
    return 'message';
  }
  if (
    value.includes('research') ||
    value.includes('latest') ||
    value.includes('scan') ||
    value.includes('search') ||
    value.includes('price') ||
    value.includes('วิเคราะห์') ||
    value.includes('ค้น') ||
    value.includes('ราคา')
  ) {
    return 'search';
  }
  if (value.includes('email') || value.includes('mail') || value.includes('อีเมล')) {
    return 'mail';
  }
  if (
    value.includes('translate') ||
    value.includes('rewrite') ||
    value.includes('repurpose') ||
    value.includes('แปล') ||
    value.includes('ปรับ')
  ) {
    return 'refresh';
  }
  if (
    value.includes('summary') ||
    value.includes('executive') ||
    value.includes('report') ||
    value.includes('proposal') ||
    value.includes('สรุป') ||
    value.includes('บันทึก')
  ) {
    return 'chart';
  }
  if (
    value.includes('write') ||
    value.includes('caption') ||
    value.includes('worksheet') ||
    value.includes('exam') ||
    value.includes('เขียน') ||
    value.includes('ข้อสอบ')
  ) {
    return 'edit';
  }
  return 'sparkles';
};

const normalizePromptTasks = (prompts: string[] = []): AgentStarterTask[] =>
  prompts.slice(0, 6).map((prompt, index) => ({
    id: `starter-${index}`,
    title: prompt,
    description: 'เริ่มจากงานนี้ แล้วปรับรายละเอียดต่อในช่องพิมพ์ได้',
    prompt,
    icon: iconFromTitle(prompt),
    priority: index < 4 ? 'primary' : 'secondary',
  }));

const matchesName = (value: string, keywords: string[]) =>
  keywords.some((keyword) => value.includes(keyword));

type PresetDefinition = {
  keywords: string[];
  tasks: AgentStarterTask[];
};

const exactNamePresets = new Map<string, AgentStarterTask[]>([
  ['general assistant', generalAssistantTasks],
  ['ผู้ช่วยทั่วไป', generalAssistantTasks],
  ['marketing & content', marketingTasks],
  ['marketing ai', marketingTasks],
  ['การตลาด & คอนเทนต์', marketingTasks],
  ['research & summary', researchTasks],
  ['ค้นคว้า & สรุป', researchTasks],
  ['customer support bot', supportTasks],
  ['บอทดูแลลูกค้า', supportTasks],
  ['sales & admin', salesAdminTasks],
  ['ขายและบริหาร', salesAdminTasks],
  ['writing assistant', writingTasks],
  ['ผู้ช่วยเขียน', writingTasks],
  ['teacher assistant', teacherTasks],
  ['ผู้ช่วยครู', teacherTasks],
  ['farm advisor', farmTasks],
  ['ที่ปรึกษาเกษตร', farmTasks],
]);

const presetDefinitions: PresetDefinition[] = [
  {
    keywords: ['marketing & content', 'marketing ai', 'marketing', 'content', 'campaign'],
    tasks: marketingTasks,
  },
  {
    keywords: ['line oa', 'line official', 'broadcast', 'oa manager', 'line'],
    tasks: lineTasks,
  },
  {
    keywords: ['research & summary', 'research and summary', 'research', 'summary', 'analyst'],
    tasks: researchTasks,
  },
  {
    keywords: ['general assistant', 'all-purpose ai coworker', 'ผู้ช่วยทั่วไป'],
    tasks: generalAssistantTasks,
  },
  {
    keywords: ['customer support bot', 'customer service representative', 'answers customer questions on line oa', 'บอทดูแลลูกค้า'],
    tasks: supportTasks,
  },
  {
    keywords: ['sales & admin', 'sales and administrative assistant', 'drafts quotations', 'ขายและบริหาร'],
    tasks: salesAdminTasks,
  },
  {
    keywords: ['writing assistant', 'professional writing assistant', 'drafts emails, letters, reports', 'ผู้ช่วยเขียน'],
    tasks: writingTasks,
  },
  {
    keywords: ['teacher assistant', 'teaching assistant for thai educators', 'creates lesson plans, exams, quizzes', 'ผู้ช่วยครู'],
    tasks: teacherTasks,
  },
  {
    keywords: ['farm advisor', 'ai farm consultant', 'ที่ปรึกษาเกษตร', 'เกษตรกรไทย'],
    tasks: farmTasks,
  },
];

export function getAgentStarterTasks({
  agentName,
  agentDescription,
  starterTasks,
  generalStarterPrompts,
}: StarterSource): AgentStarterTask[] {
  if (starterTasks && starterTasks.length > 0) {
    return starterTasks;
  }

  const normalizedAgentName = agentName?.trim().toLowerCase() ?? '';
  const exactPreset = exactNamePresets.get(normalizedAgentName);
  if (exactPreset) {
    return exactPreset;
  }

  const haystack = `${agentName ?? ''} ${agentDescription ?? ''}`.toLowerCase();
  const preset = presetDefinitions.find((entry) => matchesName(haystack, entry.keywords));

  if (preset) {
    return preset.tasks;
  }

  if (generalStarterPrompts && generalStarterPrompts.length > 0) {
    return normalizePromptTasks(generalStarterPrompts);
  }

  return fallbackTasks;
}
