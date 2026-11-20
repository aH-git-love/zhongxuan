/* Curated excerpts from the locally archived Wikisource transcription of 增删卜易. */
(function(root,factory){const data=factory();if(typeof module!=='undefined'&&module.exports)module.exports={BRAIN_CLASSICS:data};else root.BRAIN_CLASSICS=data;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const url='https://zh.wikisource.org/wiki/%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93';
  const rows=[
    ['use-parent','用神章：父母类事项','占父母者以卦中父母爻为用神。','古籍按所问事项区分用神；此条是文本规则摘录，不是现实事件验证。',1468,['父母','用神','六亲']],
    ['use-sibling','用神章：兄弟类事项','占兄弟者以兄弟爻为用神。','古籍按所问事项区分用神；同一爻的解释依占问主题而变。',1469,['兄弟','用神','六亲']],
    ['use-wealth','用神章：财物与买卖','占妻、妾、婢、仆及占财物都以妻财爻为用神。','记录古籍针对财物类问题的取用条文；应用时需保留占问主题和原盘信息。',1470,['妻财','财物','买卖','用神']],
    ['use-child','用神章：子孙类事项','占子孙者以子孙爻为用神。','记录古籍所述取用规则，不从单句推出现实结果。',1471,['子孙','用神','六亲']],
    ['use-official','用神章：功名类事项','占功名者以官鬼爻为用神。','记录古籍对功名类事项的取用规则；需与旺衰、生克等章节合看。',1472,['功名','官鬼','用神']],
    ['void-conditions','旬空章：旬空判断条件','旺不为空，动不为空，有日建动爻生扶者不为空；月破为空。','本章同时列出不同旬空情形，不能只凭“旬空”二字判作全空。',2073,['旬空','空亡','月破','旺相']],
    ['void-uncertainty','旬空章：不作一概断语','凡遇旬空，命之再占，卦吉者许之出旬而不空，卦得凶者许之空矣。','原文呈现该书的断法与再占思路；产品只把它作为古籍观点展示。',2074,['旬空','空亡','再占','出旬']],
    ['day-strength','日辰章：旺衰与日冲','爻之旺而静者冲之则为暗动；爻之衰而静者，冲之则为日破。','原文将静爻旺衰与日冲结果关联；解释时应先标注旺衰依据和所用体系。',1779,['日辰','暗动','日破','旺衰']]
  ];
  return rows.map(([id,title,quote,excerpt,line,terms])=>({id:'classic:zbzy:'+id,kind:'book-excerpt',name:title,group:'增删卜易摘录',book:'增删卜易',quote,excerpt,terms,source:{file:'tools/books/zbzy.txt',locator:'line '+line,url}}));
});
