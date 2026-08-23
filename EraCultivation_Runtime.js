// 四时代修炼运行时：封版参数与纯计算/结算接口。
// 生产者：本文件（由入口集成代理加载）；消费者：MVU_Schema_Runtime、MVU_Skill_Runtime、mvu_logic_bridge。
// 本模块不负责入口加载、事件状态判定或推进预设接线。
!(function (global) {
  'use strict';

  const VERSION = '1.0.0-era-cultivation-20260819';
  const ERA_BY_PROFILE = Object.freeze({ dldl: '斗一', jueshitangmen: '斗二', current: '斗三', zjdl: '斗四' });
  const NO_SOUL_CORE_GATE = Number.POSITIVE_INFINITY;
  const LEVEL_CAPS_BY_ERA = Object.freeze({
    斗一: Object.freeze([89, 98, 99.5, NO_SOUL_CORE_GATE]),
    斗二: Object.freeze([89, 98, 99.5, NO_SOUL_CORE_GATE]),
    斗三: Object.freeze([69, 89, 98, NO_SOUL_CORE_GATE]),
    斗四: Object.freeze([69, 89, 98, NO_SOUL_CORE_GATE]),
  });
  const LEVEL_ADJUSTMENTS = Object.freeze([[20, 30, 1.024], [30, 40, 1.014], [40, 60, 0.865]]);
  const INITIAL_LEVEL_ANCHORS = Object.freeze({
    劣等: Object.freeze([1, 2]),
    正常: Object.freeze([3, 4]),
    优秀: Object.freeze([5, 6]),
    天才: Object.freeze([7, 9]),
    顶级天才: Object.freeze([9, 10]),
    绝世妖孽: Object.freeze([10, 10]),
  });
  const PARAMETERS = Object.freeze({"version":"era-cultivation-final-20260819","fit":{"targetCount":224,"inBand":162,"rmse":1.0418983433875995,"endpointRmse":1.315521784700492},"parameters":{"baseVariationPower":1,"baseVariationAge":[0.4979959839195493,1.0787280393690946,1.868475081807203,0.4,2.1566902813911946,2.0937186893388655,0.7867733429197995,3,3,3,3,0.4],"baseVariationEraTalent":{"斗一":[1.2767868159350368,1.502450078003413,2.9277002188456,0.8435658646975894,0.6883602856586172,1.9015292242539055],"斗二":[1.36905306453291,3,2.6098049864482924,1.4550870924385657,3,3],"斗三":[1.134507063012965,3,1.2166254402355312,1.4793254723766707,2.347625467112181,1.007513298848355],"斗四":[2.9277002188456,3,2.530140886042872,0.9559730002742267,3,1.0285460387295402]},"baseVariationEarlyEraTalent":{"斗一":[2.22779597031629,1.7158500177875946,0.7714913272560323,0.2704556652599967,1.3843054560296613,1.372922965877485],"斗二":[1.7561082035111604,0.6762564167965434,0.4303740035353919,0.25494306495068947,0.5565677221390628,0.4423410979336079],"斗三":[1.64966612014534,0.8900404457693161,0.7676090105396997,0.7017878754690547,0.5903727767761343,0.9797255363170447],"斗四":[0.9772428129627441,1.6107065959671718,0.46494679618269674,2.4909730704683426,0.40328335557333267,1.1147323010477201]},"baseVariationLevelScale":0.49626535888927736,"baseVariationLevelInteractionAge":[1.411926763037311,3.6722795023395225,2.9832704558720993,2.6837022189045565,4,3.6317232692508226,1.0025938842095943,1.9311990399456676,2.088778061076873,3.017923199032935,2.510879852639606,2.1843223003236516,2.589215643440033,1.0098627115715326,2.1863538437822188,2.1823415330247316,4,1.0065742991404547,1.3726027360641875],"baseVariationLevelEraTalent":{"斗一":[0.25,0.25,0.25,2.8197285456605727,2.6237614221014414,0.537256448128083],"斗二":[0.2851542460215194,0.5305593808580059,0.6439191596055792,4,3.2519845798462383,2.1826144743527607],"斗三":[0.48598732879061446,0.3896227293458124,0.9829085051448,2.9619308937208415,2.81512547727651,0.9913958721863375],"斗四":[2.021036464685537,0.9787608431166123,4,1.757204592103971,3.1984344107514233,3.71771456361346]},"eraSpeed":{"斗一":[0.7495464968537389,0.8224188029542704,0.4759392896926258,0.44922029714085043,0.5595462695688294,0.4886629632342205,0.68,0.6782740999621101,0.19,0.28,0.19109720003036187,2.4,0.3343908503234612,0.4643828438789588,0.24506062558186686,0.20015593122753345,0.17785207839132247],"斗二":[0.8215300826105891,1.250468261414683,0.9056329418424843,0.9021770098070113,1.3584417923669134,1.351534048843821,1.3304658716187274,0.313875,0.31124748994971835,0.25,0.2,0.2154764076942245,2,0.6,0.2758918742887087,0.19974684404034868,0.1757047975331545],"斗三":[0.8938846232487758,1.1561115484690871,1.4840167912780864,1.0209309658859043,1.0103692324723326,0.9811126646794737,1.4810352797267032,0.32843478744764526,0.31124748994971835,0.319196750625,0.11624999999999999,0.25,0.175,0.175,0.24978042254273342,0.27621978574004197,0.2882836914508411],"斗四":[2.1878693493173844,2.6341615902585085,2.207557366079394,2.130832630917113,2.8623313921924756,3.086369119415535,2.739104083002093,2.47,3.002915783034882,0.7438016635284314,0.6224949798994366,0.8224331438404774,4.069293363519384,2.003098664421504,0.125,0.537279644118651,0.5314126351712608]},"age":[1.0248956879779547,0.9998564791024275,1.0454005634750043,1.0241012852221343,0.8524123574748944,1.018571300014914,1.036136122906551,1.0326995934514527,0.9563951435968767,1.2380860037478265,1.7145893991296635,1.4579999999999997],"eraAge":{"斗一":[0.9693911558633354,0.9562127479044699,0.9961030785871681,1.035126935489949,0.9791419264691344,1.0389090400777454,1.614187791369933,0.5723056069741264,2.4096579867074968,3,1.5114767960496258,1.188787333535486],"斗二":[1.0573187704634683,1.0877042363682539,1.0412014431379644,0.9907292441733878,0.5,0.6858710562414266,1.773459626820328,0.5,1.4624940040089622,1.1476262258268746,1.0265822596516483,0.955140919271386],"斗三":[0.9647869483161198,0.8835826571204083,1.2389300268277823,1.020123038213062,0.5,0.5,0.8346915643477403,0.5,0.5,0.8105355042110842,0.9437749231169428,0.959021314070607],"斗四":[0.9897986124315382,1.0165931587684436,1.040268941607992,1.012053114302191,1.1089654825965245,0.7802809471912119,1.0316407881361418,0.9571470887356958,0.9785751883396724,0.9362648559084683,1.3065353034355514,1.9444201058151935]},"talentAge":{"劣等":[1.6847069331995053,2.5,1.042484737306117,0.5,0.5,0.5,0.7881401250000001,0.5,0.5,2.1083749199862343,1.332231315642055,1.1847833551041038],"正常":[0.6815105104884247,1.7022763981032467,0.9084481192534247,1.0291419210878534,1.6393848913918594,1.3622237135189306,2.008048322256247,1.6996247783368132,1.6054807704817782,2.5,1.42214781735739,1.198739495509842],"优秀":[0.5,0.5,0.8556162918822491,0.5,1.0431886490059745,1.2963050433590546,1.061286542591397,2.5,2.5,2.5,2.5,1.5668520142458344],"天才":[0.9701863745492119,1.0083557327249473,1.0209609852449286,1.0109629942682128,1.2707080092291,1.853666012305746,1.5670969819653346,0.5,0.5,2.5,1.4617999305784573,1.1851756644030214],"顶级天才":[0.9602770670650209,1.0126376483270971,1.0193377122684413,0.9864145739296348,1.4044442023349863,1.0071589227880304,0.5,0.5,1.4516975987318044,1.0902517139329213,0.5,0.5],"绝世妖孽":[0.9105717757803334,0.8324882176885542,0.5659639530419476,1.0099031707485668,2.5,1.6641889705692665,1.2686953645188963,1.2556845808044022,1.3511861467123814,0.6455207166311776,2.4406882621765953,1.566044921959584]},"eraTalent":{"斗一":[1.0236748833476894,1.1558214099633772,1.0625866696432973,0.9667625093331897,0.9681124003706107,1.2226611388254065],"斗二":[0.7177639557849422,0.8890052003962025,0.9067000463538913,1.0545575778460883,1.4214995750795552,1.3178305456369916],"斗三":[0.7628522276124383,1.011020548220019,0.8200499629207901,1.0264524138279367,1.1121613083186466,0.9623890688686814],"斗四":[0.67,0.9913813588195795,0.7201161547566616,0.9684677004568549,0.862379130496571,1.0398272921709308]},"eraTalentAge":{"斗一":{"劣等":[1.5771666336619574,1.4842648553879272,0.5804100076310071,1.0279935692554731,1.0193523999797298,1.348202283958404,1.0736913642701376,1.0258466048528965,1.2516943661431408,0.25,0.25,0.5798880069864283,0.7894070178536525,0.8906381747687799,0.9476384560289461,0.9881414967023187,0.9709077883172317,0.986586867028031,0.9833072217021408],"正常":[1.0940015464709032,1.4100207767263908,0.7461905710885003,0.7013260431022952,0.3999735531746385,0.5866593118569643,0.6176819277662448,0.6184167197821232,0.68788766875704,0.4483188161409855,0.45276376809355556,1.645359479327898,1.2399391854937682,1.0891149329331087,1.0540481316649657,1.0298546640357606,1.0337364007998486,1.0230859964405894,1.01547661807167],"优秀":[0.826074898632328,1.0762859388841965,1.3791697660121283,1.1641020774367234,0.8286584257621995,1.0687641275448403,0.26903571428571427,0.4971467441148835,0.5359083928217081,3,3,0.8127323357412841,3,1.4881878139352458,1.1637057503402808,1.079411862031835,1.041257712642797,1.0326481247718733,1.0141982059944936],"天才":[0.8882258550726676,0.4953784898550122,0.5524751918437587,0.25,0.6946167322978184,0.8488910654162813,0.9468653556549875,1.0682312744486249,0.6607919154001191,2.6166245019201653,2.720887145034537,0.970821780054595,1.020027112437109,1.3330513480880448,0.25,0.5968786442512045,0.8306007709328379,0.9180739248894452,0.9630805947025357],"顶级天才":[0.9932605705968964,0.8695513466469962,1.0281028275902278,1.076116340398189,1.3648990109498058,0.8229505837926259,0.5971705073925685,0.6391919660834038,0.7739720047287298,0.9140190748053008,2.0165751777612493,1.3546724252505464,0.28922506699164047,3,1.0794216830182413,1.004947234219507,0.997726311243589,0.9844037161877983,0.9826806673560355],"绝世妖孽":[1.0099449809571825,0.9998066649963103,1.0881255414317514,1.043111880737092,1.423399768269679,0.8645144684386552,1.0903504676104465,1.1834282436692123,1.1553073847931556,1.0429968611410854,0.8156702787817803,0.5301751511784232,1.175786770183076,1.4479654993785833,0.4456108085900869,3,1.5395387717407893,1.221926651754136,1.1017911287233697]},"斗二":{"劣等":[2.2597022126987842,1.0757019937756034,0.9785887793086081,0.9687855640881735,1.297990384777868,1.273227634600722,0.9977870554814041,0.994140021974846,0.9842872058207515,0.25,0.25,0.5871801243451833,0.8265197727566299,0.9148588265565948,0.9456254410160613,0.9596181059569053,0.9774665380424947,0.9790012653354685,0.9775721632576636],"正常":[1.1628243566397956,1.6257238840142394,0.5642920063484463,0.5916487933655209,0.39898329664897697,0.4505887239402709,1.1431265442863816,1.2069619771994382,0.7838704535510882,1.8499708596911106,1.2505054554399633,1.1472210822026396,1.060708246587431,1.031939757023261,1.0126845854536322,1.018023956997409,1.0130346475478755,1.0244091236354738,1.009848760402453],"优秀":[0.8337224574960407,0.9930822458866249,2.085402146170804,3,0.9302208413918761,1.2242590931862334,0.25,0.33790419601043953,0.9059499585524217,0.6775956879476324,0.25,0.40797140089504375,1.8406016436214745,1.2532277974970978,1.100891885940852,1.0596835338038668,1.0331229742998862,0.9937723047075584,0.9784791922392018],"天才":[1.0368471147069676,1.5478445282113302,1.0415145191012718,1.3866301576759164,1.7465143176459808,0.25,0.8783618213724331,1.032615130203522,0.9699071618627374,0.5832198408096183,0.8958309124408046,0.25,0.25,0.25,0.25,0.6061854106909093,0.8198108660101711,0.9080199939254778,0.9445623453592282],"顶级天才":[0.9100817320701393,0.9051918393490668,0.9771302607237344,1.1596848839123708,2.428332423827565,0.7652424521286393,0.5385037826232022,0.25,0.25,0.25,0.25,0.25,1.1128959370275737,0.25,1.7257701772481986,1.2224009527837971,1.0780381755640893,1.032504388467259,1.0238437910178648],"绝世妖孽":[0.9104563006339759,1.0296445244795605,1.0598054367909173,1.053985653970446,0.9638417791855377,0.25,0.9415123247829107,0.3489406816288539,0.5519640846013453,3,3,3,1.5514315741065943,1.2171303065055312,1.1116835503149516,1.0472459743227627,1.0323305031782122,1.026008899167102,1.0152667789348497]},"斗三":{"劣等":[2.001969030315789,1.63041256131436,1.0696387728761925,1.0789615013994358,1.0298443038767322,0.9320107577502621,1.0365856252011787,1.0428405635498659,0.9856601824023523,0.25,0.25,0.5860808665492638,0.8070478968241535,0.9056578018055094,0.9672113346924852,0.967831889395044,0.978432652061209,0.9741067703334616,0.9968294126134861],"正常":[1.069229201665318,1.3636311422602816,0.5770578231514958,0.5540555377095692,0.7252141417611986,1.499814705390701,1.5274880820835164,1.568590666439013,1.525629666022747,1.2370407264430654,1.1385533271292572,0.9342419387758062,0.9835597524947401,0.9879934919824933,0.9963312199221409,1.001474253899339,1.010380299442868,1.0189109791832913,1.0098708708569408],"优秀":[0.8911799253927709,1.1650958219925756,2.9277002188456,3,0.7529901205711114,1.1551091629723873,1.3162412268778216,1.2227856408308129,1.3887526998931141,0.9869673735369304,0.9613089059292487,1.238958706405859,0.5366824071017803,0.7816912260569941,0.9154424848438136,0.976128487784081,0.9886271090661858,0.983460243108307,0.9935223633466969],"天才":[0.7738241641768188,1.4454748360942964,1.0108402654080753,1.0065734373495783,1.4642965891669828,1.140020397824325,0.6879075715754761,0.25,0.25,0.3112474899497183,0.25,0.25,0.25,0.25,0.25,0.588342948620814,0.7973804579775744,0.8909625318335334,0.9380686634948732],"顶级天才":[0.6864829544993619,1.43724928048343,0.9569745832389158,1.047875954149608,1.1771595877467533,0.9567070964395581,1.1418076534197097,0.43589139107577135,0.2930924123274646,0.9229358652683584,3,3,0.8831945041319642,0.25,0.25,0.6008619336039355,0.8388231940367624,0.9414762152598563,0.9727581712338257],"绝世妖孽":[0.6518025177350614,1.6682452241880168,1.0575497931339843,0.25,0.25,0.25,1.2159250679985067,0.2824875,2.7952542224358727,0.25,2.550994920525589,1.41269051271011,1.1330250980553873,1.0423209246450758,1.0256344502333197,1.0229439967658966,0.9870074347984649,1.0004089327009054,1.0158433673648937]},"斗四":{"劣等":[1.197212848552941,1.0390920342331793,0.8058451966457476,1.1025,0.25,0.25,0.5130257061174159,0.25,0.437855625,0.3230690147073613,0.3650518331685829,0.25,0.692526326736374,0.5049384315716844,0.45,2.8940625000000004,1.463158906592969,1.1556435781635555,1.096339761103098],"正常":[0.66380172458345,1.0461304217379954,0.25,1.05,1.1757789535567311,0.8428522964564381,1,1,0.8849949112792601,0.5806451612903226,0.5138680130008607,0.6276855927859065,3,1.2555,1.2555,1.5382920109623321,1.2011267516273525,1.050207892788757,1.0246950765959597],"优秀":[0.7459199933239862,1.881676423158921,1.21550625,0.30661155628609427,0.9070294784580498,1,1,1,1,2.5614449047363874,0.8083521602545696,0.9057512911488023,0.5497277371875,0.512822615302431,0.5746131064883939,3,3,1.5606774439347526,1.2631072217347126],"天才":[0.6144393241167434,0.3964124671720925,1.12995,1.6680214285714288,0.25,0.25,0.25,0.25,0.25,3,1.5546180559403204,1.2326664298327255,1.1499132744810359,1.2326664298327255,1.5606774439347526,3,1.5606774439347528,1.2233554330278331,1.1187651927847688],"顶级天才":[0.5851803086826128,1,1,2.05,0.25,0.25,0.25,3,2.0101359273138413,3,1.7776706024604192,0.8844764782938913,0.25,0.4341902484798571,0.25,0.25,0.55746539359291,1.3056557536719346,0.5186370641331773],"绝世妖孽":[0.9070294784580498,1.1025,1,1.05,1.2437179888686742,1.3497169792943227,0.4242402568859526,0.5138680130008607,0.4331148348332823,1.7965675308597568,1.7965675308597568,1.1130000000000002,0.5680357612985433,1,0.9759000729485332,0.9070294784580499,1.1356808018431646,0.3155443385489361,0.5034384498056929]}},"earlyTalent":{"斗一":{"天才":[0.43244544640821364,0.35,2.500954500842054,1.2059064061979623,0.907273510050897],"顶级天才":[0.4368951891168401,1.1537657338066123,1.203814469167021,1.2528923703934967,1.0144635694998145],"绝世妖孽":[0.4667485789304254,1.515275774003847,1.619502471728594,3,1.727353395489245]},"斗二":{"天才":[0.35,0.5459237188185248,0.5047231439082077,1.0085169761115822,0.7456059061609557],"顶级天才":[0.3657578201625605,0.922175685513882,1.6666042182051581,1.3493100898636647,0.6817619314700436],"绝世妖孽":[0.40513202313309543,0.7712677519986336,0.792441655921001,0.9036271455046584,0.8011869995045944]},"斗三":{"天才":[0.47849002595453294,1.1261448564692351,1.2858582005099441,1.422892908016476,1.0957739741103394],"顶级天才":[0.5105187738554425,1.4497304459211735,1.0777154357275311,1.6441855766127036,1.4890859166711818],"绝世妖孽":[0.547361819102901,1.5528638142886804,0.9484962160134778,0.35,0.35]},"斗四":{"天才":[0.4511421947013212,0.774990937658956,1.5493864035281797,1.0660439904588637,0.35],"顶级天才":[0.9910079911304388,2.059285714285714,2.4432343875000004,0.5573145796977265,0.35],"绝世妖孽":[0.6248571428571429,1.1211928875000001,3,0.7345440762813352,1.3092559631338052]}},"coreGrowth":{"斗一":[1,3,2.344386782786573,1],"斗二":[1,0.9523809523809523,0.5,1],"斗三":[1,1,0.5,0.5],"斗四":[1,1,3,1]},"coreSpeed":{"斗一":[0.8485684507456963,0.7647724901739319,0.9798537014021512],"斗二":[7.5,5,4.90284715268797],"斗三":[10,5,3.5217834495488796],"斗四":[50.7406266621718,15,5]},"coreTalent":{"斗一":{"劣等":[1.0260891247607724,1.029245472534995,1.029524384482194],"正常":[0.9745499806703812,0.9718495271639761,0.9767199130275941],"优秀":[1.0123287127127358,1.0124103527428636,1.001784616760402],"天才":[0.9923119480615286,0.9963681073639648,0.9845695243897493],"顶级天才":[1.1822968880013451,1.0739944154245225,1.0312575163513005],"绝世妖孽":[0.5541726360375865,1.6388349609276016,1.2709393035783028]},"斗二":{"劣等":[0.9801267775090508,0.9938401401691063,1.0054167261461608],"正常":[1.0021777341618996,0.993590667500584,0.9987293810938052],"优秀":[0.2532268807741641,0.5789440085864597,0.7505493899034209],"天才":[0.7418448431415,0.25,0.5036605889440537],"顶级天才":[0.2563634866124277,0.25,0.49770828968704856],"绝世妖孽":[0.6486932826904201,0.25,0.5006466466373088]},"斗三":{"劣等":[0.9899286394680074,0.9874703423716484,0.9812240501267946],"正常":[1.0087316162081594,1.0123897572175193,0.9978156284697426],"优秀":[0.27974208184564914,2.5793545044249773,1.7122226611685387],"天才":[0.25,0.25,0.4914719283491743],"顶级天才":[5,0.25,2.024336504904118],"绝世妖孽":[0.7780950043462816,0.47876741300925163,0.25]},"斗四":{"劣等":[0.9785298682766161,0.9802885733802494,1.0061101066964098],"正常":[0.45361114703344146,2.2584719226134555,1.4948292658950986],"优秀":[0.34814110834916684,0.6617744985213488,0.8170541109719696],"天才":[1.5235885444718453,0.25,1.6146225441144149],"顶级天才":[0.313875,0.25,0.6669747501353607],"绝世妖孽":[0.25,0.3875,0.31421028521812383]}}},"levelBands":["1-20","20-40","40-50","50-60","60-64","64-67","67-70","70-75","75-80","80-90","90-95","95-98","98-99","99-99.5","99.5-100","100-120","120+"],"ageBands":["6-12","12-18","18-22","22-30","30-40","40-50","50-60","60-80","80-100","100-200","200-500","500+"],"coreRules":{"斗一":[{"startLevel":89,"bottleneckLevel":89,"sourceStage":0},{"startLevel":98,"bottleneckLevel":98,"sourceStage":1}],"斗二":[{"startLevel":50,"bottleneckLevel":69,"sourceStage":0},{"startLevel":80,"bottleneckLevel":89,"sourceStage":1}],"斗三":[{"startLevel":50,"bottleneckLevel":69,"sourceStage":0},{"startLevel":80,"bottleneckLevel":89,"sourceStage":1},{"startLevel":95,"bottleneckLevel":98,"sourceStage":2}],"斗四":[{"startLevel":50,"bottleneckLevel":69,"sourceStage":0},{"startLevel":80,"bottleneckLevel":89,"sourceStage":1},{"startLevel":95,"bottleneckLevel":98,"sourceStage":2}]},"finalCapRules":{"斗一":{"顶级天才":97},"斗二":{"顶级天才":99},"斗三":{"顶级天才":[{"probability":0.5,"cap":98},{"probability":0.3,"cap":99},{"probability":0.2,"cap":99.5}]},"斗四":{"天才":[{"probability":0.75,"cap":99},{"probability":0.25,"cap":105}],"顶级天才":[{"probability":0.75,"cap":109},{"probability":0.25,"cap":115}],"绝世妖孽":146}},"meditation":{"defaultHours":8,"斗三第一核后Hours":12},"baseVariation":{"min":0.95,"max":1.05,"deterministicFit":1,"growthPower":1,"ageResponse":[0.4979959839195493,1.0787280393690946,1.868475081807203,0.4,2.1566902813911946,2.0937186893388655,0.7867733429197995,3,3,3,3,0.4],"eraTalentResponse":{"斗一":[1.2767868159350368,1.502450078003413,2.9277002188456,0.8435658646975894,0.6883602856586172,1.9015292242539055],"斗二":[1.36905306453291,3,2.6098049864482924,1.4550870924385657,3,3],"斗三":[1.134507063012965,3,1.2166254402355312,1.4793254723766707,2.347625467112181,1.007513298848355],"斗四":[2.9277002188456,3,2.530140886042872,0.9559730002742267,3,1.0285460387295402]},"earlyEraTalentResponse":{"斗一":[2.22779597031629,1.7158500177875946,0.7714913272560323,0.2704556652599967,1.3843054560296613,1.372922965877485],"斗二":[1.7561082035111604,0.6762564167965434,0.4303740035353919,0.25494306495068947,0.5565677221390628,0.4423410979336079],"斗三":[1.64966612014534,0.8900404457693161,0.7676090105396997,0.7017878754690547,0.5903727767761343,0.9797255363170447],"斗四":[0.9772428129627441,1.6107065959671718,0.46494679618269674,2.4909730704683426,0.40328335557333267,1.1147323010477201]},"levelResponseScale":0.49626535888927736,"levelInteractionAgeResponse":[1.411926763037311,3.6722795023395225,2.9832704558720993,2.6837022189045565,4,3.6317232692508226,1.0025938842095943,1.9311990399456676,2.088778061076873,3.017923199032935,2.510879852639606,2.1843223003236516,2.589215643440033,1.0098627115715326,2.1863538437822188,2.1823415330247316,4,1.0065742991404547,1.3726027360641875],"levelEraTalentResponse":{"斗一":[0.25,0.25,0.25,2.8197285456605727,2.6237614221014414,0.537256448128083],"斗二":[0.2851542460215194,0.5305593808580059,0.6439191596055792,4,3.2519845798462383,2.1826144743527607],"斗三":[0.48598732879061446,0.3896227293458124,0.9829085051448,2.9619308937208415,2.81512547727651,0.9913958721863375],"斗四":[2.021036464685537,0.9787608431166123,4,1.757204592103971,3.1984344107514233,3.71771456361346]}},"coreVariation":{"gain":1,"power":21,"asymmetric":true,"eras":["斗一"],"talents":["顶级天才"],"stages":[0],"enabled":true,"rule":"魂核凝聚速度 × max(1, 底子波动^power)，仅作用于 斗一·顶级天才·第一核；用于表达“60岁只有约10%顶级天才能达到90级、且通过者底子波动≥1.04”的分布描点。"},"meta":{"eras":["斗一","斗二","斗三","斗四"],"bookEraMap":{"dldl":"斗一","jueshitangmen":"斗二","current":"斗三","zjdl":"斗四"},"talents":["劣等","正常","优秀","天才","顶级天才","绝世妖孽"],"earlyTalents":["天才","顶级天才","绝世妖孽"],"levelBandLimits":[20,40,50,60,64,67,70,75,80,90,95,98,99,99.5,100,120,null],"ageBandLimits":[12,18,22,30,40,50,60,80,100,200,500,null],"earlyAgeBandLimits":[10,12,15,18,22],"interactionAgeBandLimits":[10,12,15,18,19,22,25,28,30,35,40,50,60,80,100,200,300,500,null],"startAge":6,"ticksPerDay":144,"meditationTicksPerDay":{"default":48,"斗三第一核后":72},"cultivationStopAges":{"劣等":40,"正常":50,"优秀":60,"天才":90,"顶级天才":100,"绝世妖孽":120},"decayRules":{"before30":1,"30-40":0.35,"40+":0.1,"talentBonus":{"天才":0.15,"优秀":{"30-40":0.069,"40+":0.0493},"顶级天才":0.32,"绝世妖孽":0.3},"100+":0.1,"斗四":{"顶级天才":{"shiftYears":100},"绝世妖孽":{"shiftYears":100},"优秀":{"100+":"noDecay"}}},"effectiveTalentRule":{"15岁前":{"from":["天才","顶级天才","绝世妖孽"],"to":"天才"},"20岁前":{"from":["顶级天才","绝世妖孽"],"to":"顶级天才"}}},"projectSoulCoreStages":[{"requiredCoreCount":0,"nextCoreIndex":1,"startLevel":50,"bottleneckLevel":69,"baseAttemptChance":0.0125,"talentRatioMap":{"劣等":0.01,"正常":0.02,"优秀":1.55,"天才":3,"顶级天才":2,"绝世妖孽":3.2}},{"requiredCoreCount":1,"nextCoreIndex":2,"startLevel":80,"bottleneckLevel":89,"baseAttemptChance":0.054,"talentRatioMap":{"劣等":0.01,"正常":0.02,"优秀":0.18,"天才":0.55,"顶级天才":0.9,"绝世妖孽":1.3}},{"requiredCoreCount":2,"nextCoreIndex":3,"startLevel":95,"bottleneckLevel":98,"baseAttemptChance":0.0045,"talentRatioMap":{"劣等":0.01,"正常":0.01,"优秀":0.02,"天才":0.04,"顶级天才":1.2,"绝世妖孽":18}}],"projectTalentCoreRates":{"劣等":[0.45,0.02,0.01,0.01],"正常":[0.88,0.03,0.02,0.01],"优秀":[1.1,1.85,0.08,0.04],"天才":[0.95,1.08,6.1,0.8],"顶级天才":[1.05,0.5,18,160],"绝世妖孽":[1.15,0.68,30,180]}});

  const freezeDeep = (value, seen = new WeakSet()) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    Object.keys(value).forEach(key => freezeDeep(value[key], seen));
    return Object.freeze(value);
  };
  freezeDeep(PARAMETERS);

  const clamp = (value, low, high) => Math.max(low, Math.min(high, Number(value)));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
  const limits = key => (PARAMETERS.meta[key] || []).map(value => value === null ? Infinity : Number(value));
  const levelLimits = limits('levelBandLimits');
  const ageLimits = limits('ageBandLimits');
  const earlyAgeLimits = limits('earlyAgeBandLimits');
  const interactionAgeLimits = limits('interactionAgeBandLimits');
  const talents = PARAMETERS.meta.talents;
  const earlyTalents = new Set(PARAMETERS.meta.earlyTalents);
  const D4_DAILY_TICK_SCALE_IN_D3_CORE_WINDOW = (
    Number(PARAMETERS.meditation.defaultHours || 8)
    / Number(PARAMETERS.meditation['斗三第一核后Hours'] || 12)
  );
  const levelBandIndex = level => Math.max(0, limits('levelBandLimits').findIndex(upper => finite(level, 0) < upper));
  const ageBandIndex = age => Math.max(0, ageLimits.findIndex(upper => Math.max(0, finite(age, 0)) < upper));
  const earlyAgeBandIndex = age => Math.max(0, earlyAgeLimits.findIndex(upper => Math.max(0, finite(age, 0)) < upper));
  const interactionAgeBandIndex = age => Math.max(0, interactionAgeLimits.findIndex(upper => Math.max(0, finite(age, 0)) < upper));
  const talentIndex = talent => Math.max(0, talents.indexOf(String(talent || '').trim()));
  const safeEra = era => PARAMETERS.meta.eras.includes(era) ? era : '斗一';

  function libraryRuntime() {
    const candidates = [global];
    try { if (global.parent && global.parent !== global) candidates.push(global.parent); } catch (_) {}
    try { if (global.top && global.top !== global) candidates.push(global.top); } catch (_) {}
    return candidates.map(item => item && item.__LWCS_LIBRARY_DATA_RUNTIME_V1__).find(item => item && typeof item === 'object') || null;
  }

  function resolveEraAtTick(tick) {
    const library = libraryRuntime();
    if (!library || typeof library.resolveEraAtTick !== 'function') throw new Error('LibraryData_Runtime 2.0.0 未加载，无法按绝对tick解析时代');
    const era = ERA_BY_PROFILE[library.resolveEraAtTick(Math.max(0, finite(tick, 0)))];
    if (!era) throw new Error('LibraryData_Runtime返回未知时代profile');
    return era;
  }

  function resolveEra(char = {}, options = {}) {
    if (options && options.currentTick !== undefined && options.currentTick !== null) return resolveEraAtTick(options.currentTick);
    if (options && options.era) return safeEra(options.era);
    const explicit = String(char?.属性?.时代 || char?.所属时代 || char?.时代 || '').trim();
    if (PARAMETERS.meta.eras.includes(explicit)) return explicit;
    const book = String(char?.所属部 || char?.所属书库 || char?.book || char?.bookId || '').trim();
    return safeEra(PARAMETERS.meta.bookEraMap[book] || '斗一');
  }

  function directZJDLTick() {
    const library = libraryRuntime();
    const startYear = Number(library?.profiles?.zjdl?.startYear);
    const ticksPerYear = Number(library?.ticksPerYear);
    return Number.isFinite(startYear) && Number.isFinite(ticksPerYear) && startYear >= 0 && ticksPerYear > 0
      ? startYear * ticksPerYear
      : Number.POSITIVE_INFINITY;
  }

  function resolveCultivationEra(char = {}, options = {}) {
    if (options && options.cultivationEra) return safeEra(options.cultivationEra);
    if (options && options.currentTick !== undefined && options.currentTick !== null) {
      const tick = Math.max(0, finite(options.currentTick, 0));
      const library = libraryRuntime();
      const d3Threshold = Number(library?.eraThresholds?.current?.thresholdTick);
      if (tick >= directZJDLTick()) return '斗四';
      if (Number.isFinite(d3Threshold) && tick >= d3Threshold) return '斗三';
    }
    return resolveEra(char, options);
  }

  function resolveBlend(tick, options = {}) {
    if (options && options.blend && typeof options.blend === 'object') {
      const zjdl = clamp(options.blend.zjdl, 0, 1);
      return { current: 1 - zjdl, zjdl, mode: String(options.blend.mode || 'provided'), stage: Math.round(zjdl * 10) };
    }
    const library = libraryRuntime();
    if (!library || typeof library.getCultivationEraBlend !== 'function') return null;
    const hasTick = tick !== undefined && tick !== null && Number.isFinite(Number(tick));
    if (options.directZJDL === true || (hasTick && Number(tick) >= directZJDLTick()) || options.deepAbyssAbsorptionTick !== undefined) {
      return library.getCultivationEraBlend(tick, {
        directZJDL: options.directZJDL === true || (hasTick && Number(tick) >= directZJDLTick()),
        deepAbyssAbsorptionTick: options.deepAbyssAbsorptionTick,
      });
    }
    return hasTick ? library.getCultivationEraBlend(tick) : null;
  }

  function smoothRatio(ratio) {
    const value = clamp(ratio, 0, 1);
    return value * value * (3 - 2 * value);
  }

  function soulPowerCurve(level) {
    const value = clamp(level || 1, 1, 180);
    const anchors = [
      [1, 100], [10, 800], [20, 2000], [30, 4500], [40, 8500], [50, 15000], [60, 26000],
      [70, 55000], [80, 95000], [90, 180000], [95, 360000],
    ];
    const last = anchors[anchors.length - 1];
    if (value >= last[0] && value <= 99) return last[1] * 2 ** (value - last[0]);
    if (value > 99 && value <= 99.5) return last[1] * 16 * 2 ** ((value - 99) / 0.5);
    if (value > 99.5 && value <= 100) return last[1] * 32 * 2 ** ((value - 99.5) / 0.5);
    if (value > 100) return last[1] * 64 * 10 ** ((value - 100) / 10);
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const start = anchors[index];
      const end = anchors[index + 1];
      if (value >= start[0] && value <= end[0]) return start[1] + (end[1] - start[1]) * smoothRatio((value - start[0]) / (end[0] - start[0]));
    }
    return anchors[0][1];
  }

  function oldSoulPowerCurve(level) {
    const value = clamp(level || 1, 1, 100);
    if (value <= 29) return 100 + ((2200 - 100) / 28) * (value - 1);
    if (value === 30) return 3000;
    if (value <= 69) return 3200 + ((9000 - 3200) / 38) * (value - 31);
    if (value === 70) return 14000;
    if (value <= 89) return 14500 + ((17000 - 14500) / 18) * (value - 71);
    if (value === 90) return 18500;
    if (value <= 94) return 18875 + ((20000 - 18875) / 3) * (value - 91);
    if (value <= 99) return 20000 * 2 ** (value - 94);
    if (value <= 99.5) return 20000 * 2 ** 5 * 2;
    return 20000 * 2 ** 5 * 4;
  }

  function extendedOldSoulPowerCurve(level) {
    const value = finite(level, 1);
    if (value <= 100) return oldSoulPowerCurve(value);
    const lastStep = oldSoulPowerCurve(100) - oldSoulPowerCurve(99.5);
    return oldSoulPowerCurve(100) + lastStep * (value - 100);
  }

  function nextLevel(level) {
    const value = Math.max(0, finite(level, 0));
    if (value >= 99.5 && value < 100) return 100;
    if (value >= 99 && value < 99.5) return 99.5;
    return Math.floor(value) + 1;
  }

  function soulPowerCurveCalibration(level, next = null) {
    const start = Math.max(1, finite(level, 1));
    const end = Math.max(start, finite(next === null ? nextLevel(start) : next, start));
    if (start < 70 || end === start) return 1;
    const oldDelta = Math.max(0.0001, extendedOldSoulPowerCurve(end) - extendedOldSoulPowerCurve(start));
    const newDelta = Math.max(0.0001, soulPowerCurve(end) - soulPowerCurve(start));
    return Math.max(0.01, newDelta / oldDelta);
  }

  function effectiveTalent(age, talent) {
    const value = String(talent || '').trim() || '正常';
    if (finite(age, 0) < 15 && ['天才', '顶级天才', '绝世妖孽'].includes(value)) return '天才';
    if (finite(age, 0) < 20 && ['顶级天才', '绝世妖孽'].includes(value)) return '顶级天才';
    return value;
  }

  function cultivationStopAge(era, talent) {
    const base = Number(PARAMETERS.meta.cultivationStopAges[talent] ?? 0);
    if (era === '斗四' && talent === '优秀') return 400;
    if (era === '斗四' && ['顶级天才', '绝世妖孽'].includes(talent)) return Infinity;
    return base + (era === '斗四' ? 100 : 0);
  }

  function shiftedAge(era, age, talent) {
    return era === '斗四' && ['顶级天才', '绝世妖孽'].includes(talent) ? Math.max(0, finite(age, 0) - 100) : Math.max(0, finite(age, 0));
  }

  function ageDecayMultiplier(era, age, talent) {
    const ageValue = finite(age, 0);
    if (ageValue >= cultivationStopAge(era, talent)) return 0;
    const shifted = shiftedAge(era, ageValue, talent);
    if (shifted < 30) return 1;
    const rules = PARAMETERS.meta.decayRules;
    const base = shifted < 40 ? Number(rules['30-40'] || 0.35) : Number(rules['40+'] || 0.1);
    const bonus = rules.talentBonus?.[talent];
    const talentBonus = typeof bonus === 'object' ? (shifted < 40 ? Number(bonus['30-40'] || 0) : Number(bonus['40+'] || 0)) : Number(bonus || 0);
    let value = Math.max(0, base + talentBonus);
    if (era === '斗四' && talent === '优秀' && shifted >= 100) return value;
    if (shifted >= 100) value = Math.max(0.01, value * 0.1);
    return value;
  }

  function cultivationAgeDecayMultiplier(char = {}, options = {}) {
    const age = finite(char?.属性?.年龄, 0);
    const talent = String(char?.属性?.天赋梯队 || '').trim() || '正常';
    const era = resolveCultivationEra(char, options);
    const blend = resolveBlend(options.currentTick, options);
    if (blend && era === '斗三') {
      return Number(blend.current || 0) * ageDecayMultiplier('斗三', age, talent)
        + Number(blend.zjdl || 0) * ageDecayMultiplier('斗四', age, talent);
    }
    return ageDecayMultiplier(era, age, talent);
  }

  function youthYieldMultiplier(age, talent) {
    const value = effectiveTalent(age, talent);
    const ageValue = finite(age, 0);
    if (ageValue < 12) return ({ 劣等: 0.05, 正常: 0.1, 优秀: 0.2, 天才: 0.36, 顶级天才: 0.36, 绝世妖孽: 0.36 })[value] || 0.1;
    if (ageValue < 18) return ({ 劣等: 0.1, 正常: 0.18, 优秀: 0.42, 天才: 0.62, 顶级天才: 0.82, 绝世妖孽: 0.82 })[value] || 0.25;
    if (ageValue < 22) return ({ 劣等: 0.16, 正常: 0.26, 优秀: 0.72, 天才: 1, 顶级天才: 1.05, 绝世妖孽: 1.1 })[value] || 0.4;
    if (ageValue < 30) return ({ 劣等: 0.2, 正常: 0.32, 优秀: 0.9, 天才: 1.1, 顶级天才: 1.85, 绝世妖孽: 5.2 })[value] || 0.45;
    return 1;
  }

  function baseVariation(char = {}, override = undefined) {
    const value = override === undefined ? char?.属性?.底子波动 : override;
    return clamp(Number.isFinite(Number(value)) && Number(value) !== 0 ? Number(value) : 1, PARAMETERS.baseVariation.min, PARAMETERS.baseVariation.max);
  }

  function cultivationMultiplier(char = {}, options = {}) {
    const cultivationEra = resolveCultivationEra(char, options);
    const age = Math.max(0, finite(char?.属性?.年龄, 0));
    const level = Math.max(0, finite(options.levelOverride === undefined ? char?.属性?.等级 : options.levelOverride, 0));
    const talent = String(char?.属性?.天赋梯队 || '').trim() || '正常';
    const coreCount = Math.max(0, integer(options.coreCountOverride === undefined ? char?.魂核?.核心?.数量 : options.coreCountOverride, 0));
    const params = PARAMETERS.parameters;
    const ageIndex = ageBandIndex(age);
    const levelIndex = levelBandIndex(level);
    const interactionIndex = interactionAgeBandIndex(age);
    const realizedTalent = effectiveTalent(age, talent);
    const talentIdx = talents.includes(realizedTalent) ? talents.indexOf(realizedTalent) : talents.indexOf('正常');
    const rawTalentIdx = talents.includes(talent) ? talents.indexOf(talent) : talents.indexOf('正常');
    const variation = baseVariation(char, options.baseVariation);
    const singleEraMultiplier = eraValue => {
      const exponent = Number(params.baseVariationPower || 1)
        * Number(params.baseVariationAge[ageIndex] || 1)
        * Number(params.baseVariationEraTalent[eraValue]?.[rawTalentIdx] || 1)
        * (age < 22 ? Number(params.baseVariationEarlyEraTalent[eraValue]?.[rawTalentIdx] || 1) : 1);

      let value = Number(params.eraSpeed[eraValue]?.[levelIndex] || 1)
        * Number(params.age[ageIndex] || 1)
        * Number(params.eraAge[eraValue]?.[ageIndex] || 1)
        * Number(params.talentAge[realizedTalent]?.[ageIndex] || 1)
        * Number(params.eraTalent[eraValue]?.[talentIdx] || 1)
      * Number(params.eraTalentAge[eraValue]?.[talent]?.[interactionIndex] || 1)
        * Number(params.coreGrowth[eraValue]?.[Math.min(3, coreCount)] || 1);
      if (age < 22 && earlyTalents.has(talent)) value *= Number(params.earlyTalent[eraValue]?.[talent]?.[earlyAgeBandIndex(age)] || 1);
      return value * variation ** exponent;
    };
    const blend = resolveBlend(options.currentTick, options);
    const blendD4TickScale = cultivationEra === '斗三' && coreCount >= 1 ? D4_DAILY_TICK_SCALE_IN_D3_CORE_WINDOW : 1;
    const eraFactor = blend && cultivationEra === '斗三'
      ? Number(blend.current || 0) * singleEraMultiplier('斗三') + Number(blend.zjdl || 0) * singleEraMultiplier('斗四') * blendD4TickScale
      : singleEraMultiplier(cultivationEra);
    return Math.max(0, eraFactor);
  }

  function soulPowerRequirement(level, variation = 1) {
    return Math.max(0, soulPowerCurve(level) * clamp(variation, PARAMETERS.baseVariation.min, PARAMETERS.baseVariation.max));
  }

  function getTalentCoreRate(char = {}, options = {}) {
    const age = finite(char?.属性?.年龄, 0);
    const talent = effectiveTalent(age, String(char?.属性?.天赋梯队 || '').trim() || '正常');
    const coreCount = Math.min(3, Math.max(0, integer(options.coreCountOverride === undefined ? char?.魂核?.核心?.数量 : options.coreCountOverride, 0)));
    return Math.max(0, Number(PARAMETERS.projectTalentCoreRates[talent]?.[coreCount] || 0));
  }

  function getLevelCapForCoreCount(charOrOptions = {}, maybeOptions = {}) {
    const options = maybeOptions && typeof maybeOptions === 'object' ? maybeOptions : {};
    const char = charOrOptions && charOrOptions.属性 ? charOrOptions : options.char || {};
    const era = resolveCultivationEra(char, { ...options, era: options.era || charOrOptions?.era });
    const coreCount = Math.min(3, Math.max(0, integer(options.coreCountOverride === undefined ? char?.魂核?.核心?.数量 : options.coreCountOverride, 0)));
    return Number(LEVEL_CAPS_BY_ERA[era]?.[coreCount] ?? NO_SOUL_CORE_GATE);
  }

  function requiredCoreCountForLevel(era, level) {
    const caps = LEVEL_CAPS_BY_ERA[safeEra(era)] || LEVEL_CAPS_BY_ERA.斗三;
    const target = finite(level, 0);
    const index = caps.findIndex(cap => target <= cap);
    return index < 0 ? 3 : index;
  }

  function finalLevelCap(char = {}, options = {}) {
    const era = resolveCultivationEra(char, options);
    const talent = String(char?.属性?.天赋梯队 || '').trim() || '正常';
    const rule = PARAMETERS.finalCapRules[era]?.[talent];
    if (typeof rule === 'number') return rule;
    if (Array.isArray(rule)) {
      const q = (baseVariation(char, options.baseVariation) - PARAMETERS.baseVariation.min) / (PARAMETERS.baseVariation.max - PARAMETERS.baseVariation.min);
      let cumulative = 0;
      for (const item of rule) {
        cumulative += Number(item.probability || 0);
        if (q < cumulative) return Number(item.cap);
      }
      return Number(rule[rule.length - 1].cap);
    }
    return 99.5;
  }

  function isNaturalCultivationAllowed(char = {}, options = {}) {
    const level = finite(options.levelOverride === undefined ? char?.属性?.等级 : options.levelOverride, 0);
    return cultivationAgeDecayMultiplier(char, options) > 0 && level < finalLevelCap(char, options);
  }

  function advanceNaturalLevel(char = {}, options = {}) {
    if (!char?.属性 || typeof char.属性 !== 'object') return { advanced: 0, level: 0 };
    const era = resolveCultivationEra(char, options);
    const variation = baseVariation(char, options.baseVariation);
    const coreCount = Math.max(0, integer(char?.魂核?.核心?.数量, 0));
    const requirementMultiplier = Math.max(0, finite(options.requirementMultiplier, 1));
    const naturalCap = finalLevelCap(char, options);
    const levelCap = Number.isFinite(Number(options.levelCap)) ? Number(options.levelCap) : NO_SOUL_CORE_GATE;
    const cap = Math.min(naturalCap, levelCap);
    const nonCultivationSoulPowerBonus = Math.max(0, finite(options.nonCultivationSoulPowerBonus, 0));
    let level = Math.max(0, finite(char.属性.等级, 0));
    let advanced = 0;
    while (level < cap) {
      const next = nextLevel(level);
      if (next === null || next > cap || requiredCoreCountForLevel(era, next) > coreCount) break;
      if (
        Math.max(0, finite(char.属性.魂力上限, 0) - nonCultivationSoulPowerBonus)
        < soulPowerRequirement(next, variation) * requirementMultiplier
      ) break;
      level = next;
      advanced += 1;
    }
    if (advanced > 0) char.属性.等级 = level;
    return { advanced, level };
  }

  function getSoulCoreStage(char = {}, options = {}) {
    const era = resolveCultivationEra(char, options);
    const coreCount = Math.min(2, Math.max(0, integer(options.coreCountOverride === undefined ? char?.魂核?.核心?.数量 : options.coreCountOverride, 0)));
    const level = Math.max(0, finite(options.levelOverride === undefined ? char?.属性?.等级 : options.levelOverride, 0));
    const rule = PARAMETERS.coreRules[era]?.[coreCount];
    if (!rule || level < Number(rule.startLevel)) return null;
    const projectStage = PARAMETERS.projectSoulCoreStages[coreCount];
    if (!projectStage) return null;
    const span = Math.max(1, Number(rule.bottleneckLevel) - Number(rule.startLevel));
    return {
      era,
      coreCount,
      nextCoreIndex: Number(projectStage.nextCoreIndex),
      startLevel: Number(rule.startLevel),
      bottleneckLevel: Number(rule.bottleneckLevel),
      baseAttemptChance: Number(projectStage.baseAttemptChance),
      talentRatioMap: projectStage.talentRatioMap,
      proximity: clamp((level - Number(rule.startLevel)) / span, 0, 1),
    };
  }

  function soulCoreSuccessChance(char = {}, options = {}) {
    const stage = getSoulCoreStage(char, options);
    if (!stage || !isNaturalCultivationAllowed(char, options)) return 0;
    const talent = String(char?.属性?.天赋梯队 || '').trim() || '正常';
    const ratio = Number(stage.talentRatioMap[talent] || stage.talentRatioMap.正常 || 0.55);
    const blend = resolveBlend(options.currentTick, options);
    const coreTalentFactor = eraValue => Number(PARAMETERS.parameters.coreTalent[eraValue]?.[talent]?.[Math.min(2, stage.coreCount)] || 1);
    const factor = blend && stage.era === '斗三'
      ? Number(blend.current || 0) * coreTalentFactor('斗三') + Number(blend.zjdl || 0) * coreTalentFactor('斗四')
      : coreTalentFactor(stage.era);
    return clamp(stage.baseAttemptChance * ratio * (0.3 + 0.7 * stage.proximity ** 1.2) * factor, 0.0001, 0.35);
  }

  function soulCoreAttemptDelta(char = {}, segmentDelta = 0, options = {}) {
    const stage = getSoulCoreStage(char, options);
    if (!stage || !(segmentDelta > 0)) return 0;
    const level = finite(options.levelOverride === undefined ? char?.属性?.等级 : options.levelOverride, 0);
    const cultivationEra = resolveCultivationEra(char, options);
    const levelCap = getLevelCapForCoreCount(char, { ...options, cultivationEra, coreCountOverride: stage.coreCount });
    const next = nextLevel(level);
    const bottleneck = next !== null && requiredCoreCountForLevel(cultivationEra, next) > stage.coreCount || level >= levelCap;
    const variation = baseVariation(char, options.baseVariation);
    const coreVariation = stage.era === '斗一' && String(char?.属性?.天赋梯队 || '').trim() === '顶级天才' && stage.coreCount === 0
      ? Math.max(1, variation ** Number(PARAMETERS.coreVariation.power || 21))
      : 1;
    const blend = resolveBlend(options.currentTick, options);
    const coreSpeed = eraValue => Number(PARAMETERS.parameters.coreSpeed[eraValue]?.[Math.min(2, stage.coreCount)] || 1);
    const speed = blend && stage.era === '斗三'
      ? Number(blend.current || 0) * coreSpeed('斗三') + Number(blend.zjdl || 0) * coreSpeed('斗四') * (stage.coreCount >= 1 ? D4_DAILY_TICK_SCALE_IN_D3_CORE_WINDOW : 1)
      : coreSpeed(stage.era);
    return Math.max(0, finite(segmentDelta, 0)) * speed
      * (bottleneck ? 2.45 : 1) * coreVariation;
  }

  function advanceSoulCoreProgress(char = {}, segmentDelta = 0, options = {}) {
    const stage = getSoulCoreStage(char, options);
    if (!stage) return { progressGain: 0, completed: 0, attemptDelta: 0, chance: 0 };
    if (!char.魂核 || typeof char.魂核 !== 'object' || Array.isArray(char.魂核)) char.魂核 = {};
    if (!char.魂核.核心 || typeof char.魂核.核心 !== 'object' || Array.isArray(char.魂核.核心)) char.魂核.核心 = { 数量: stage.coreCount, 进度: 0 };
    const chance = soulCoreSuccessChance(char, options);
    const attemptDelta = soulCoreAttemptDelta(char, segmentDelta, options);
    if (!(attemptDelta > 0) || !(chance > 0)) return { progressGain: 0, completed: 0, attemptDelta, chance };
    let progressGain = 0;
    if (options.deterministic === true) {
      progressGain = attemptDelta / 48 * chance;
    } else {
      const rng = typeof options.rng === 'function' ? options.rng : Math.random;
      const fullAttempts = Math.floor(attemptDelta / 48);
      let attempts = fullAttempts;
      const remainder = attemptDelta - fullAttempts * 48;
      if (remainder > 0 && rng() < remainder / 48) attempts += 1;
      for (let index = 0; index < attempts; index += 1) if (rng() <= chance) progressGain += 1;
    }
    char.魂核.核心.进度 = Math.max(0, finite(char.魂核.核心.进度, 0)) + progressGain;
    let completed = 0;
    while (char.魂核.核心.进度 >= 100 && completed < 1 && stage.coreCount < 3) {
      char.魂核.核心.进度 -= 100;
      char.魂核.核心.数量 = Math.max(stage.nextCoreIndex, integer(char.魂核.核心.数量, stage.coreCount) + 1);
      completed += 1;
    }
    return { progressGain, completed, attemptDelta, chance };
  }

  function meditationSchedule(char = {}, options = {}) {
    const era = resolveCultivationEra(char, options);
    const coreCount = Math.max(0, integer(options.coreCountOverride === undefined ? char?.魂核?.核心?.数量 : options.coreCountOverride, 0));
    const ticksPerDay = era === '斗三' && coreCount >= 1 ? Number(PARAMETERS.meditation['斗三第一核后Hours'] || 12) * 6 : Number(PARAMETERS.meditation.defaultHours || 8) * 6;
    return ticksPerDay === 72 ? { ticksPerDay, start: 21 * 6, end: 9 * 6 } : { ticksPerDay, start: 23 * 6, end: 7 * 6 };
  }

  function calculateMeditationGrowth(char = {}, segmentDelta = 0, options = {}) {
    if (!isNaturalCultivationAllowed(char, options)) return 0;
    const age = finite(char?.属性?.年龄, 0);
    const talent = String(char?.属性?.天赋梯队 || '').trim() || '正常';
    const level = finite(options.levelOverride === undefined ? char?.属性?.等级 : options.levelOverride, 0);
    const coreCount = Math.max(0, integer(options.coreCountOverride === undefined ? char?.魂核?.核心?.数量 : options.coreCountOverride, 0));
    const baseRate = getTalentCoreRate(char, { coreCountOverride: coreCount });
    let growth = baseRate * (Math.max(0, finite(segmentDelta, 0)) / 6);
    const cultivationEra = resolveCultivationEra(char, options);
    const blend = resolveBlend(options.currentTick, options);
    const actualEfficiency = blend && cultivationEra === '斗三'
      ? Number(blend.current || 0)
        * cultivationMultiplier(char, { ...options, cultivationEra: '斗三', blend: { current: 1, zjdl: 0 }, levelOverride: level, coreCountOverride: coreCount })
        * ageDecayMultiplier('斗三', age, talent)
        + Number(blend.zjdl || 0)
        * cultivationMultiplier(char, { ...options, cultivationEra: '斗四', blend: { current: 0, zjdl: 1 }, levelOverride: level, coreCountOverride: coreCount })
        * ageDecayMultiplier('斗四', age, talent)
        * (coreCount >= 1 ? D4_DAILY_TICK_SCALE_IN_D3_CORE_WINDOW : 1)
      : cultivationMultiplier(char, { ...options, levelOverride: level, coreCountOverride: coreCount })
        * cultivationAgeDecayMultiplier(char, options);
    growth *= actualEfficiency * youthYieldMultiplier(age, talent);
    const adjustment = LEVEL_ADJUSTMENTS.find(([lower, upper]) => level >= lower && level < upper);
    if (adjustment) growth *= adjustment[2];
    growth *= soulPowerCurveCalibration(level, nextLevel(level));
    return Math.max(0, growth * Math.max(0, finite(options.externalMultiplier, 1)));
  }

  function settleMeditationSegment(char = {}, segmentDelta = 0, options = {}) {
    const safeDelta = Math.max(0, finite(segmentDelta, 0));
    let remaining = safeDelta;
    let elapsed = 0;
    let totalGrowth = 0;
    let coresCompleted = 0;
    let levelsAdvanced = 0;
    let guard = 0;
    const nonCultivationSoulPowerBonus = Math.max(0, finite(options.nonCultivationSoulPowerBonus, 0));
    while (remaining > 0 && guard < 200000 && isNaturalCultivationAllowed(char, { ...options, levelOverride: char?.属性?.等级 })) {
      guard += 1;
      const startLevelAdvance = advanceNaturalLevel(char, options).advanced;
      levelsAdvanced += startLevelAdvance;
      const level = Math.max(0, finite(char?.属性?.等级, 0));
      const coreCount = Math.max(0, integer(char?.魂核?.核心?.数量, 0));
      const chunk = Math.min(remaining, 48);
      const growth = calculateMeditationGrowth(char, chunk, { ...options, levelOverride: level, coreCountOverride: coreCount });
      if (growth > 0 && char?.属性) {
        const current = Math.max(0, finite(char.属性.魂力上限, 0));
        const next = nextLevel(level);
        const requirementMultiplier = Math.max(0, finite(options.requirementMultiplier, 1));
        const blocked = next !== null && requiredCoreCountForLevel(resolveCultivationEra(char, options), next) > coreCount;
        const storageCap = blocked
          ? soulPowerRequirement(level, baseVariation(char, options.baseVariation)) * requirementMultiplier
            + Math.max(0, soulPowerRequirement(next, baseVariation(char, options.baseVariation)) * requirementMultiplier
              - soulPowerRequirement(level, baseVariation(char, options.baseVariation)) * requirementMultiplier) * 0.7
            + nonCultivationSoulPowerBonus
          : Number.POSITIVE_INFINITY;
        const nextValue = Math.max(current, Math.min(storageCap, current + growth));
        char.属性.魂力上限 = nextValue;
        totalGrowth += nextValue - current;
      }
      const coreResult = advanceSoulCoreProgress(char, chunk, { ...options, levelOverride: level, coreCountOverride: coreCount });
      coresCompleted += coreResult.completed;
      const endLevelAdvance = advanceNaturalLevel(char, options).advanced;
      levelsAdvanced += endLevelAdvance;
      remaining -= chunk;
      elapsed += chunk;
      if ((coreResult.completed > 0 || startLevelAdvance > 0 || endLevelAdvance > 0) && remaining > 0) continue;
      if (!(growth > 0) && coreResult.completed <= 0) break;
    }
    return { totalGrowth, coresCompleted, levelsAdvanced, elapsed, remaining };
  }

  function estimateInitialLevel(options = {}) {
    const targetAge = Math.max(0, finite(options.age, 6));
    if (targetAge < Number(PARAMETERS.meta.startAge || 6)) return 0;
    const talent = talents.includes(String(options.talent || '').trim()) ? String(options.talent).trim() : '正常';
    const variation = clamp(finite(options.baseVariation, 1), PARAMETERS.baseVariation.min, PARAMETERS.baseVariation.max);
    const era = options.currentTick !== undefined && options.currentTick !== null
      ? resolveCultivationEra({}, { currentTick: options.currentTick })
      : safeEra(options.era || PARAMETERS.meta.bookEraMap[String(options.book || '').trim()]);
    const anchor = INITIAL_LEVEL_ANCHORS[talent] || INITIAL_LEVEL_ANCHORS.正常;
    const quantile = (variation - PARAMETERS.baseVariation.min) / (PARAMETERS.baseVariation.max - PARAMETERS.baseVariation.min);
    const initialLevel = anchor[0] + (anchor[1] - anchor[0]) * clamp(quantile, 0, 1);
    const char = {
      所属时代: era,
      属性: {
        年龄: Number(PARAMETERS.meta.startAge || 6),
        等级: Math.floor(initialLevel),
        魂力上限: soulPowerRequirement(initialLevel, variation),
        天赋梯队: talent,
        底子波动: variation,
      },
      魂核: { 核心: { 数量: 0, 进度: 0 } },
    };
    if (targetAge <= char.属性.年龄 + 1e-9) return initialLevel;
    let remainingDays = (targetAge - char.属性.年龄) * Number(PARAMETERS.meta.yearDays || 360);
    while (remainingDays > 1e-9) {
      const days = Math.min(1, remainingDays);
      char.属性.年龄 += days / 720;
      const schedule = meditationSchedule(char, { cultivationEra: era });
      for (const segmentDelta of [schedule.end, Number(PARAMETERS.meta.ticksPerDay || 144) - schedule.start]) {
        const level = finite(char.属性.等级, 1);
        const coreCount = integer(char.魂核?.核心?.数量, 0);
        const growth = calculateMeditationGrowth(char, segmentDelta * days, {
          cultivationEra: era,
          currentTick: options.currentTick,
          levelOverride: level,
          coreCountOverride: coreCount,
        });
        const current = finite(char.属性.魂力上限, 0);
        const next = nextLevel(level);
        const blocked = next !== null && requiredCoreCountForLevel(era, next) > coreCount;
        const storageCap = blocked
          ? soulPowerRequirement(level, variation) + Math.max(0, soulPowerRequirement(next, variation) - soulPowerRequirement(level, variation)) * 0.7
          : Number.POSITIVE_INFINITY;
        char.属性.魂力上限 = Math.max(current, Math.min(storageCap, current + growth));
        advanceSoulCoreProgress(char, segmentDelta * days, {
          cultivationEra: era,
          currentTick: options.currentTick,
          levelOverride: level,
          coreCountOverride: coreCount,
          deterministic: true,
        });
      }
      advanceNaturalLevel(char, { cultivationEra: era });
      char.属性.年龄 += days / 720;
      remainingDays -= days;
    }
    advanceNaturalLevel(char, { cultivationEra: era });
    const level = finite(char.属性.等级, 1);
    const next = nextLevel(level);
    if (next === null || next <= level || requiredCoreCountForLevel(era, next) > integer(char.魂核?.核心?.数量, 0)) return level;
    const currentRequirement = soulPowerRequirement(level, variation);
    const nextRequirement = soulPowerRequirement(next, variation);
    const progress = nextRequirement > currentRequirement
      ? clamp((finite(char.属性.魂力上限, currentRequirement) - currentRequirement) / (nextRequirement - currentRequirement), 0, 1)
      : 0;
    return Math.max(1, Math.min(finalLevelCap(char, { cultivationEra: era }), level + (next - level) * progress + continuousLevelAdjustment(char, { cultivationEra: era })));
  }

  function continuousLevelAdjustment(char = {}, options = {}) {
    const age = finite(char?.属性?.年龄, 0);
    const era = resolveCultivationEra(char, options);
    const talent = String(char?.属性?.天赋梯队 || '').trim() || '正常';
    const variation = baseVariation(char, options.baseVariation);
    const index = interactionAgeBandIndex(age);
    const talentIndexValue = talents.includes(talent) ? talents.indexOf(talent) : talents.indexOf('正常');
    return ((variation - 1) / 0.1) * Number(PARAMETERS.parameters.baseVariationLevelScale || 1)
      * Number(PARAMETERS.parameters.baseVariationLevelInteractionAge[index] || 1)
      * Number(PARAMETERS.parameters.baseVariationLevelEraTalent[era]?.[talentIndexValue] || 1);
  }

  const API = Object.freeze({
    version: VERSION,
    parameterVersion: PARAMETERS.version,
    parameters: PARAMETERS,
    resolveEraAtTick,
    resolveEra,
    resolveCultivationEra,
    cultivationMultiplier,
    getMeditationSchedule: meditationSchedule,
    calculateMeditationGrowth,
    settleMeditationSegment,
    estimateInitialLevel,
    soulPowerCurve,
    soulPowerRequirement,
    soulPowerCurveCalibration,
    getLevelCapForCoreCount,
    requiredCoreCountForLevel,
    finalLevelCap,
    getSoulCoreStage,
    soulCoreSuccessChance,
    soulCoreAttemptDelta,
    advanceSoulCoreProgress,
    advanceNaturalLevel,
    ageDecayMultiplier,
    youthYieldMultiplier,
    continuousLevelAdjustment,
  });

  const existing = global.__LWCS_ERA_CULTIVATION_RUNTIME_V1__;
  if (existing && existing.parameterVersion !== PARAMETERS.version) throw new Error('EraCultivation_Runtime封版参数版本冲突');
  const runtime = existing || API;
  global.__LWCS_ERA_CULTIVATION_RUNTIME_V1__ = runtime;
  try { if (global.parent && global.parent !== global) global.parent.__LWCS_ERA_CULTIVATION_RUNTIME_V1__ = runtime; } catch (_) {}
  try { if (global.top && global.top !== global) global.top.__LWCS_ERA_CULTIVATION_RUNTIME_V1__ = runtime; } catch (_) {}
})(typeof globalThis !== 'undefined' ? globalThis : window);
