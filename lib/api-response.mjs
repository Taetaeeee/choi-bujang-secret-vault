export async function readApiResponse(response,path){
 const text=await response.text();let data;
 try{data=JSON.parse(text);}catch{throw new Error(`${path} 요청: 서버가 JSON 대신 오류 페이지를 반환했습니다 (HTTP ${response.status}). 잠시 후 다시 시도해 주세요.`);}
 if(!response.ok)throw new Error(response.status===503?`${path} 요청: 서버를 일시적으로 사용할 수 없습니다 (503). 잠시 후 다시 시도해 주세요.`:data.error||`${path} 요청 실패 (HTTP ${response.status})`);
 return data;
}
