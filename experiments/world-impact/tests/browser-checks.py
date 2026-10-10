"""Run on locally supplied HTML; never accesses the public game or any auth domain.
Requires the installed playwright Python package and Chromium. This is emulation,
not a physical Android/iOS/WeChat test. Boss/death controls are explicit simulations.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'standalone.html').read_text()
results=[]
def check(name,condition):
    results.append({'name':name,'passed':bool(condition)})
    if not condition: raise AssertionError(name)
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for route in ['M','A','N','F']:
        page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
        errors=[];requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda e:requests.append(e.url))
        page.set_content(html,wait_until='load')
        page.locator('[data-route="'+route+'"]').click()
        state=page.evaluate('BIS_TEST.inspect()')
        check(route+': immediate selection effect',state['world']['fields'][0]['route']==route)
        check(route+': mobile viewport no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        check(route+': nonzero canvas',page.locator('canvas').evaluate('(e)=>e.width>0 && e.height>0'))
        page.touchscreen.tap(*[page.locator('#ability').bounding_box()[k]+page.locator('#ability').bounding_box()[s]/2 for k,s in [('x','width'),('y','height')]])
        check(route+': touch activates ability',page.evaluate('BIS_TEST.inspect().world.cooldownUntil > 0'))
        page.screenshot(path=str(ROOT/f'evidence/mobile-{route}.png'),full_page=True)
        page.locator('summary').click()
        page.locator('#testWin').click()
        before=page.evaluate('BIS_TEST.inspect()')
        page.locator('#testBoss').click()
        check(route+': boss callback opens transition',page.locator('#nextRound').is_visible())
        if route=='F':page.screenshot(path=str(ROOT/'evidence/mobile-round-summary.png'),full_page=True)
        page.locator('#nextRound').click()
        after=page.evaluate('BIS_TEST.inspect()')
        check(route+': round 2 keeps mutation and cause',after['world']['round']==1 and after['world']['routes'][route]>0 and after['world']['entryEchoes'][0]['route']==route)
        check(route+': no loss of absolute strength',after['host']['mass']==before['host']['mass'] and after['host']['baseMass']==before['host']['mass'])
        check(route+': consequence shown in UI', '上一轮留下的后果' in page.locator('#echoList').inner_text())
        page.locator('#testDeath').click()
        page.locator('#restart').click()
        check(route+': death reset clears current timeline',all(v==0 for v in page.evaluate('BIS_TEST.inspect().world.routes').values()) and page.evaluate('BIS_TEST.inspect().world.entryEchoes.length')==0)
        check(route+': no JavaScript errors',not errors)
        check(route+': no network dependency',not requests)
        page.close()
    # Continuous four-region state cycle through explicit test controls.
    page=browser.new_page(viewport={'width':1280,'height':900},device_scale_factor=1)
    page.set_content(html);page.locator('[data-route="F"]').click();page.locator('summary').click()
    for round_i in range(4):
        page.locator('#testWin').click();page.locator('#testBoss').click();page.locator('#nextRound').click()
        check('four-region loop '+str(round_i+1),page.evaluate('BIS_TEST.inspect().world.round')==round_i+1)
    page.screenshot(path=str(ROOT/'evidence/desktop-echo.png'),full_page=True)
    page.close()
    for width,height in [(320,700),(390,844),(768,1024)]:
        page=browser.new_page(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
        page.set_content(html);page.locator('[data-route="N"]').click()
        check('layout '+str(width),page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        box=page.locator('#down').bounding_box();before=page.evaluate('BIS_TEST.inspect().host.lane')
        page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down()
        page.wait_for_function('BIS_TEST.inspect().host.lane > '+str(before+.06))
        page.mouse.up()
        check('held input works '+str(width),page.evaluate('BIS_TEST.inspect().host.lane')>before)
        page.locator('#pause').click();paused=page.evaluate('BIS_TEST.inspect().world.time')
        page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        check('pause freezes time '+str(width),page.evaluate('BIS_TEST.inspect().world.time')==paused)
        page.close()
    # Show a real moving enemy affected by a fungal field, not just a test callback.
    page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page.set_content(html);page.locator('[data-route="F"]').click()
    page.wait_for_function("(()=>{const h=BIS_TEST.inspect().host,w=document.querySelector('canvas').getBoundingClientRect().width;return h.enemies.some(e=>e.currentModifier && e.currentModifier.source==='F' && e.currentModifier.speedFactor<1 && e.x-h.x+w*.26>25 && e.x-h.x+w*.26<w-25)})()",timeout=15000)
    check('moving enemy receives fungal slow',True)
    page.screenshot(path=str(ROOT/'evidence/mobile-fungal-chase.png'),full_page=True)
    page.close();browser.close()
report={'scope':'Independent local HTML harness; not public site or native WeChat',
        'browser':'Installed Chromium; mobile viewport and touch emulation',
        'boss_testing':'Explicit simulation callbacks, not a completed boss fight',
        'passed':sum(x['passed'] for x in results),'failed':sum(not x['passed'] for x in results),'checks':results}
(ROOT/'evidence/browser-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'passed':report['passed'],'failed':report['failed'],'scope':report['scope']},ensure_ascii=False))
