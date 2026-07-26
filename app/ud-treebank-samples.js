// Offline cache of the default analysis sample from UD Abkhaz AbNC 2.18.
// Source: https://github.com/UniversalDependencies/UD_Abkhaz-AbNC
// License: CC BY-SA 4.0. Contributor: Paul Meurer.
export const bundledUdTreebankSamples = {
  ab: `# sent_id = abiblia+achatw-uasiat+w6500
# text = аҵабырг мҩа иақәиҵарц ари адгьыл ахь дшаашьҭыз.
# text-transcription = ac̣abərg my°a ik°ic̣arc ari adg’əl ax’ dšaaš’təz.
1	аҵабырг	а-ҵа́бырг	NOUN	Noun_NH_Sg_Det	Animacy=Nhum|Definite=Def|Number=Sing	3	obj	_	LMSeg:а-ҵа́бырг
2	мҩа	а́-мҩа	NOUN	Noun_NH_Sg	Animacy=Nhum|Number=Sing	3	xcomp	_	LMSeg:а́-мҩа
3	иқәиҵарц	а́-қәҵара	VERB	V_Dyn_Tr_NonFin_Purp_S:3SgM_DO:3	Dyn=Yes|Gender[subj]=Masc|Mood=Prp|Number[subj]=Sing|Person[obj]=3|Person[subj]=3|Subcat=Tran|VerbForm=NonFin	0	root	_	LMSeg:а́-қә·ҵа-ра
4	ари	ари́	PRON	Pron_Dem_Prox_Sg	Number=Sing|PronType=Dem	5	det	_	LMSeg:ари́
5	адгьыл	а́дгьыл	NOUN	Noun_NH_Sg_[Det]	Animacy=Nhum|Number=Sing	7	obl	_	LMSeg:а́дгьыл
6	ахь	а́хь	ADP	PP_Poss:3SgNH	Gender[psor]=Neut|Number[psor]=Sing|Person[psor]=3	5	case	_	LMSeg:а́хь
7	дшаашьҭыз	а́ашьҭра	VERB	V_Dyn_Tr_StatPass_NonFin_Cnv_Impf_How_S:3SgH	Dyn=No|Gender[subj]=Com|Number[subj]=Sing|Person[subj]=3|RelType=Mnr|Subcat=Tran|Tense=Imp|VerbForm=NonFin|Voice=Pass	3	advcl	_	LMSeg:а́а·ашьҭ-ра|SpaceAfter=No
8	.	.	PUNCT	Punct_Period	_	3	punct	_	LMSeg:.
`,
};
