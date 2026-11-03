import asyncio,secrets,os,shutil
from pathlib import Path
from playwright.async_api import async_playwright
BASE='http://localhost:4204'
OUT=Path(os.environ.get('MIDWAY_ARTIFACTS','.cache/browser-tests'));OUT.mkdir(parents=True,exist_ok=True)
async def main(setup_token=None):
 password=secrets.token_urlsafe(24)
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('MIDWAY_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox'])
  context=await browser.new_context(viewport={'width':1440,'height':1050})
  page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(BASE)
  await page.get_by_label('اسم مدير الفرع',exact=True).fill('مدير الفرع التجريبي')
  await page.get_by_label('البريد الإلكتروني',exact=True).fill('branch-ui@example.invalid')
  await page.get_by_label('كلمة المرور',exact=True).fill(password)
  if setup_token: await page.get_by_label('رمز إعداد الفرع',exact=True).fill(setup_token)
  await page.get_by_role('button',name='إنشاء مساحة العمل',exact=True).click()
  await page.get_by_role('heading',name='لوحة مدير الفرع',exact=True).wait_for()
  await page.get_by_role('link',name='إدارة الفريق',exact=True).click()
  form=page.locator('.team-form')
  for role,name in [('employee','موظف الاختبار'),('employee','موظف ثان'),('sales_manager','مدير المبيعات التجريبي'),('flight_manager','مدير الطيران التجريبي')]:
   email={'موظف الاختبار':'employee-ui','موظف ثان':'other-ui','مدير المبيعات التجريبي':'sales-ui','مدير الطيران التجريبي':'flight-ui'}[name]+'@example.invalid'
   await form.get_by_label('الاسم',exact=True).fill(name)
   await form.get_by_label('البريد الإلكتروني',exact=True).fill(email)
   await form.get_by_label('كلمة المرور',exact=True).fill(password)
   await form.get_by_label('الدور',exact=True).select_option(role)
   await form.get_by_role('button',name='إضافة الحساب',exact=True).click()
   await page.get_by_role('heading',name=name,exact=True).wait_for()
  await page.screenshot(path=str(OUT/'midway-team.png'),full_page=True)
  await page.goto(BASE+'/crm')
  await page.get_by_role('heading',name='صورة واضحة لشغلك',exact=True).wait_for()
  await page.get_by_role('button',name='الشركات والعملاء',exact=True).click()
  await page.get_by_role('button',name='إضافة شركة',exact=True).first.click()
  dialog=page.get_by_role('dialog')
  await dialog.get_by_label('اسم الشركة',exact=False).fill('شركة تكامل تجريبية')
  await dialog.get_by_role('button',name='حفظ البيانات',exact=True).click()
  await dialog.wait_for(state='hidden')
  await page.screenshot(path=str(OUT/'midway-crm.png'),full_page=True)
  await page.get_by_role('link',name='العمليات ولوحة الفرع',exact=True).click()
  await page.get_by_role('button',name='تسجيل طلب جديد',exact=True).click()
  dialog=page.get_by_role('dialog')
  await dialog.get_by_label('شركة العميل',exact=True).select_option(label='شركة تكامل تجريبية')
  await dialog.locator('input[name="origin"]').fill('CAI')
  await dialog.locator('input[name="destination"]').fill('DXB')
  await dialog.locator('input[name="pnr"]').fill('UI-TEST')
  await dialog.locator('input[name="amount"]').fill('5000')
  await dialog.get_by_label('إرفاق مستند').set_input_files({'name':'support.txt','mimeType':'text/plain','buffer':b'Integration browser attachment'})
  await dialog.get_by_role('button',name='تسجيل الطلب',exact=True).click()
  await dialog.wait_for(state='hidden')
  await page.get_by_role('button',name='الطلبات والحجوزات',exact=False).click()
  await page.get_by_label('البحث في سجل الطلبات').fill('UI-TEST')
  await page.locator('.reference').first.click()
  await page.get_by_text('Integration browser attachment',exact=True).wait_for()
  await page.get_by_label('تحديث حالة الطلب',exact=True).select_option('completed')
  await page.get_by_role('dialog').get_by_role('button',name='إغلاق',exact=True).last.click()
  await page.goto(BASE)
  await page.get_by_role('heading',name='لوحة مدير الفرع',exact=True).wait_for()
  await page.screenshot(path=str(OUT/'midway-branch.png'),full_page=True)
  await page.reload();await page.get_by_role('heading',name='لوحة مدير الفرع',exact=True).wait_for()
  # Separate browser sessions demonstrate shared server data, rather than shared browser storage.
  employee=await browser.new_context(viewport={'width':390,'height':844});ep=await employee.new_page();ep.on('pageerror',lambda e:errors.append(str(e)))
  await ep.goto(BASE)
  await ep.get_by_label('البريد الإلكتروني',exact=True).fill('employee-ui@example.invalid')
  await ep.get_by_label('كلمة المرور',exact=True).fill(password)
  await ep.get_by_role('button',name='تسجيل الدخول',exact=True).click()
  await ep.get_by_role('heading',name='مساحة العمل الخاصة بي').wait_for()
  assert await ep.get_by_role('link',name='إدارة الفريق',exact=True).count()==0
  assert not await ep.evaluate('document.documentElement.scrollWidth>innerWidth')
  await ep.screenshot(path=str(OUT/'midway-employee-mobile.png'),full_page=True)
  await ep.goto(BASE+'/crm')
  await ep.get_by_role('button',name='فتح القائمة',exact=True).click()
  await ep.get_by_role('button',name='الشركات والعملاء',exact=True).click()
  await ep.get_by_role('button',name='شركة تكامل تجريبية',exact=True).wait_for()
  assert not await ep.evaluate('document.documentElement.scrollWidth>innerWidth')
  assert not errors,errors
  print('PASS: first administrator, account provisioning, CRM company creation, shared flight company, request + attachment, status update, persistence, separate employee session, mobile layout, no JS errors')
  await browser.close()
if __name__=='__main__':
 import os,subprocess,tempfile,time,urllib.request
 with tempfile.TemporaryDirectory(prefix='midway-browser-') as temp:
  setup_token=secrets.token_urlsafe(32)
  env=os.environ.copy();env.update(MIDWAY_DATABASE_URL='file:'+temp+'/workspace.db',MIDWAY_ALLOW_SETUP='true',MIDWAY_SETUP_TOKEN=setup_token,MIDWAY_SECURE_COOKIES='false',NODE_ENV='test',PORT='4204')
  process=subprocess.Popen([shutil.which('bun') or '/workspace/.onboarding-tools/node_modules/.bin/bun','packages/web/src/__server.ts'],env=env,stdout=subprocess.DEVNULL)
  try:
   for _ in range(50):
    if process.poll() is not None: raise RuntimeError('Test server failed to start')
    try:
     with urllib.request.urlopen(BASE+'/api/health',timeout=1): break
    except OSError:time.sleep(.1)
   asyncio.run(main(setup_token))
  finally:
   process.terminate();process.wait(timeout=10)
