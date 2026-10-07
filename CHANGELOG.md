# Changelog

All notable changes to Warshati are listed here. Versions follow [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-06

أول إصدار عام لورشتي: برنامج سطح مكتب لإدارة محل تصليح الهواتف، يعمل بالكامل بلا إنترنت على Windows.

- **تذاكر الصيانة:** الزبون، الجهاز (ماركة وموديل باقتراحات فورية)، الملحقات المستلمة، تصنيف العطل، السعر، الفني، والدفع نقداً أو ديناً مع عربون (نوع الدفع يُحدَّد تلقائياً: نقداً إن لم يبقَ شيء، وديناً إن بقي جزء). الحالة تمر من "قيد الإصلاح" إلى "جاهز" ثم "تم التسليم"، وكل تغيير يُسجَّل بتاريخه.
- **تعديل التذاكر:** تصحيح أي معلومة أُدخلت خطأً بعد الإنشاء: الزبون، الجهاز، الملحقات، التصنيف، الفني، السعر، المبلغ المدفوع، وتكلفة القطع. تعديل تذكرة مسلَّمة يُراجَع قبل الحفظ ويعيد حساب توزيع أرباحها بنفس القاعدة. كل تعديل يُسجَّل في سجل التذكرة (القيمة القديمة والجديدة ووقت التعديل)، والتكلفة تبقى مخفية فيه حتى تنقر لإظهارها. تعديل بيانات الزبون يظهر في سجل كل تذاكره. تذكرة سُجّلت لزبون خاطئ تُربط بالزبون الصحيح، ويقترح البرنامج إعادة طباعة الملصق إن تغيّر ما يُطبع عليه.
- **ملصق باركود 40×20mm** لكل جهاز، مضبوط لطابعات الملصقات الحرارية 203 DPI. مسح الملصق بقارئ USB يفتح التذكرة من أي شاشة، ويسأل أولاً إن كان في تذكرة جديدة أو تعديل تغييرات غير محفوظة. والبحث ممكن بالاسم أو الهاتف أو الرمز.
- **تكلفة القطع والأرباح:** الربح الصافي = السعر − تكلفة القطعة. يُقسَّم بنسبة كل تصنيف، والنسبة تُجمَّد عند التسليم. التذاكر التي ينقصها التكلفة تبقى أرباحها "مؤقتة" حتى تُضاف. التكلفة لا تظهر على الملصق، وهي مخفية في الواجهة حتى تنقر لإظهارها.
- **التقارير:** الدخل وحصة كل شريك لكل فترة، حسب الفني وحسب التصنيف، مع الديون. والتذاكر الجاهزة المتأخرة تظهر بتنبيه في القائمة.
- **نسخ احتياطي تلقائي** إلى مجلد تختاره (فلاشة USB مثلاً)، وتصدير واستيراد يدوي للقاعدة. تنبيه ظاهر في الشاشة ما دامت البيانات بلا نسخة.
- واجهة **عربية وإنجليزية**، ووضع **فاتح ومظلم**.
- **الإعدادات:** التصنيفات ونسبها، الماركات والموديلات، الملحقات، الفنيون، طابعة الملصقات، و"اختبار القارئ".
- **مثبّت Windows x64** يثبّت للمستخدم الحالي دون صلاحيات مدير. إلغاء التثبيت لا يحذف بيانات المحل.

First public release of Warshati, an offline Windows desktop app for running a phone repair shop.

- **Repair tickets:** customer, device (brand and model with type-ahead), accessories left with the device, repair category, price, technician, and cash or credit payment with a deposit (the type is set automatically: cash when nothing is left to pay, credit when part remains). Status goes from in progress to ready to delivered, and every change is logged with its time.
- **Editing tickets:** fix anything entered by mistake after creation: customer, device, accessories, category, technician, price, amount paid and parts cost. Editing a delivered ticket is reviewed before saving and recalculates its profit split with the same rule. Every edit is recorded in the ticket history (old value, new value and time); the cost stays hidden there until you click to show it. A change to a customer's details shows in the history of every ticket of that customer. A ticket recorded for the wrong customer can be attached to the right one, and the app offers to reprint the label when printed information changes.
- **40×20 mm barcode label** for each device, tuned for 203 DPI thermal label printers. Scanning a label with a USB reader opens its ticket from any screen, and asks first when a new ticket or an edit has unsaved changes. Tickets can also be found by name, phone or code.
- **Parts cost and profit:** net profit = price − parts cost. It is split by each repair category's percentage, frozen at delivery. Tickets still missing a cost keep a "provisional" profit until it is entered. The cost never appears on the label, and the app hides it until you click to show it.
- **Reports:** income and each partner's share per period, by technician and by category, with debts. Ready tickets left too long are flagged in the list.
- **Automatic backups** to a folder you choose (a USB drive, for example), plus manual export and import of the database. A banner stays on screen while the data has no backup.
- **Arabic and English** interface, **light and dark** themes.
- **Settings:** repair categories and their splits, brands and models, accessories, technicians, the label printer, and a scanner test.
- **Windows x64 installer** that installs for the current user without administrator rights. Uninstalling keeps the shop's data.

[1.0.0]: https://github.com/fateh-beddiaf/warshati/releases/tag/v1.0.0
