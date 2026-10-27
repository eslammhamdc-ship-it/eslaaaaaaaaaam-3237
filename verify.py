import asyncio
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
  page=await b.new_page(viewport={'width':1280,'height':900})
  await page.goto('http://localhost:4200')
  await page.get_by_role('heading',name='حركة الطلبات').wait_for()
  d=await page.evaluate('''()=>new Promise(resolve=>{const q=indexedDB.open('midway-flight-operations-v1');q.onsuccess=()=>{const r=q.result.transaction('state').objectStore('state').get('data');r.onsuccess=()=>resolve(r.result)}})''')
  rows=d['requests'];total=len(rows);issued=sum(r['status']=='completed' and r['service']=='flight' for r in rows);pending=sum(r['status'] in ['new','progress','waiting'] for r in rows);closed=sum(r['status'] in ['cancelled','refunded'] for r in rows)
  assert list(map(int,await page.locator('.kpi-card>strong').all_text_contents()))==[total,issued,pending,closed]
  assert pending+closed+sum(r['status']=='completed' for r in rows)==total
  await page.get_by_role('button',name='تصفية',exact=False).click()
  await page.locator('.expanded-filters select').nth(0).select_option('e2')
  subset=[r for r in rows if r['employeeId']=='e2']
  assert int(await page.locator('.kpi-card>strong').first.inner_text())==len(subset)
  assert int(await page.locator('.donut strong').inner_text())==len(subset)
  await page.locator('.expanded-filters input').fill('NOT-A-REAL-REQUEST')
  assert list(map(int,await page.locator('.kpi-card>strong').all_text_contents()))==[0,0,0,0]
  await page.get_by_text('لا توجد طلبات مطابقة').wait_for()
  await page.get_by_role('button',name='شركات العملاء',exact=True).click()
  await page.get_by_role('button',name='إضافة شركة',exact=True).click()
  await page.get_by_label('اسم الشركة',exact=True).fill(d['companies'][0]['name'])
  await page.get_by_role('button',name='حفظ الشركة',exact=True).click()
  await page.get_by_text('توجد شركة بهذا الاسم بالفعل.').wait_for()
  await page.keyboard.press('Escape')
  assert await page.get_by_role('dialog').count()==0
  await page.get_by_label('تبديل الدور التجريبي').select_option('employee')
  await page.get_by_role('button',name='الطلبات والحجوزات',exact=False).click()
  ownrefs=set(r['ref'] for r in rows if r['employeeId']=='e1')
  assert all(t in ownrefs for t in await page.locator('.reference').all_text_contents())
  assert await page.get_by_role('button',name='شركات العملاء',exact=True).count()==0
  await page.set_viewport_size({'width':768,'height':1024})
  assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
  await page.screenshot(path='/home/user/midway/tablet-check.png',full_page=True)
  print('Dataset KPI reconciliation, exclusive statuses, employee/chart filters, empty state, duplicate client validation, Escape focus behavior, employee demo scope, tablet overflow: PASS')
  await b.close()
asyncio.run(main())
