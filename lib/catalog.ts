export type Profile = {
 includeUnknownExperience?:boolean; allowBroadRegion?:boolean; desiredRole?:string; relevantExperienceYears?:number; showMismatch?:boolean; name: string; education: string; major: string; career: string; projects: string;
 regions: string[]; keywords: string; allowContract: boolean; allowShift: boolean; saraminMode?: string; work24Mode?: string; companyBoards?: {name:string;url:string}[];
 certificates:{name:string;status:string}[]; skills:{name:string;level:string}[];
};
export const defaultProfile: Profile = {
 name:'사용자', education:'확인 필요', major:'',
 career:'', projects:'',
 regions:['대전','세종','충남','충북'], keywords:'전산, 정보보안, 네트워크, IT 인프라, 시스템 운영, 서버',
 allowContract:true, allowShift:false, saraminMode:'auto', work24Mode:'auto', companyBoards:[],
 certificates:[], skills:[]
};
export const sourceCatalog = [
 {id:'alio',name:'알리오',kind:'공공기관 공식 목록·상세 API',mode:'env',scope:'신청자격·우대사항·접수기간·원문·첨부 링크',note:'data.go.kr에서 공공기관 채용정보 조회서비스를 승인받은 인증키(Decoding)를 Cloudflare Secret ALIO_API_KEY에 설정합니다. 선택 지역의 목록 최대 100건에서 키워드가 일치하는 상세 최대 8건을 조회합니다. 담당업무 전용 필드가 없어 검증 대기로 표시하며, 모집 직무별 요건은 원문·직무기술서 확인이 필요합니다.',docs:'https://www.data.go.kr/data/15125273/openapi.do',apply:'https://www.data.go.kr/data/15125273/openapi.do'},
 {id:'jobaram',name:'세종 잡아람',kind:'공공 채용페이지',mode:'public',scope:'엔케이 세종병원 공고 1건 원문 확인',note:'세종일자리경제진흥원 채용관의 공고 한 건을 직접 읽습니다. 기업 홈페이지 API와 구분하며, 다른 공고 전체 검색 기능은 아닙니다.',docs:'https://www.jobaram.com/recruitment/view/id/907',apply:'https://www.jobaram.com/recruitment/view/id/907'},
 {id:'saramin',name:'사람인',kind:'공식 API · 공개 페이지 임시 수집',mode:'hybrid',scope:'API 승인 전 임시 수집 · 승인키 연결 후 API 우선',note:'자동 모드는 승인키가 있으면 공식 API, 없으면 공개 검색 목록을 임시 수집합니다. 각 모드의 실제 성공·실패를 표시합니다. 임시 수집은 앞의 키워드 최대 2개·목록 최대 80건 중 관련 후보 최대 4건의 공개 상세·동일 공고 iframe 본문을 확인합니다. API 모드도 목록 중 최대 4건의 본문을 보완하며, 그 밖의 공고는 API 요약만 표시합니다. 본문·이미지·표준 정보·이전 자료의 확인 상태를 구분합니다. 키를 등록한 API 호출이 실패해도 임시 수집으로 숨겨 전환하지 않습니다.',docs:'https://oapi.saramin.co.kr/guide/job-search',apply:'https://oapi.saramin.co.kr/'},
 {id:'work24',name:'고용24',kind:'공식 API · 공개 페이지 임시 수집',mode:'hybrid',scope:'승인 전 공개 원문 임시 수집 · 승인키 연결 후 API 우선',note:'자동 모드는 승인키가 있으면 공식 API, 없으면 공개 검색·상세 페이지를 조회합니다. 앞의 검색어 최대 6개·검색 최대 2페이지(각 30건 요청) 중 고용24 직접등록 후보 최대 8건을 확인합니다. 다른 채용사이트에서 연계한 공고는 제외합니다. 임시 수집은 광역지역 검색 후 실제 근무지를 비교하며 모든 공고를 상세 확인 필요로 표시합니다. API 오류를 임시 수집으로 숨기지 않습니다. API 모드는 현재 대전·세종·충남·충북 또는 전국만 지역 코드가 검증되어 있습니다.',docs:'https://m.work24.go.kr/cm/e/a/0110/selectOpenApiSvcInfo.do?fullApiSvcId=000000000000000000000000000000%5E000000000000000000000000000001%5E000000000000000000000000000003',apply:'https://www.work24.go.kr/cm/e/a/0110/selectOpenApiIntro.do'},
 {id:'jobkorea',name:'잡코리아',kind:'공개 페이지 임시 수집',mode:'temporary',scope:'지원자격·모집요강 우선 수집 · 본문 프레임·이미지 링크 보완',note:'첫 검색 키워드와 선택 광역지역 최대 4곳의 공개 목록을 조회하고 관련 공고 최대 3건의 지원자격·모집요강을 읽습니다. 본문 프레임은 조회당 합계 최대 2건입니다. 이미지형은 원본 링크를 표시하고 이미지 속 추가 필수조건은 확인 필요로 남깁니다. robots 규칙과 접근 제한을 확인하며, 본문 실패 시 확보한 정보와 이전 자료를 구분해 보관합니다. 공식 제휴 API 어댑터는 별도 구현·승인 대기입니다.',docs:'https://www.jobkorea.co.kr/service/api',apply:'https://www.jobkorea.co.kr/'},
 {id:'company',name:'기업 채용페이지',kind:'기업 공식 채용목록 직접 등록',mode:'registered',scope:'Greenhouse·Lever 기업 채용목록 · 별도 인증키 없이 조회',note:'기업명과 공식 채용목록 URL을 등록하면 공개된 목록·본문을 읽습니다. 최대 2개 기업, Greenhouse 상세는 조회당 합계 최대 2건입니다. 지원하지 않는 일반 홈페이지는 사이트별 수집기 확인이 필요합니다. 실제 근무지역·제목을 비교하며, 본문과 요건이 부족하면 검증 대기로 표시합니다. 연결 성공 0건은 등록 기업에 채용이 없다는 뜻이 아닙니다.',docs:'https://docs.greenhouse.io/job-board.html',apply:'https://github.com/lever/postings-api'}
];
export const historyJobs: Record<string,any>[] = [];
