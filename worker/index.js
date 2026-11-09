const HTML = /*HTML*/"";
const headers = {"Cache-Control":"private, no-store", "X-Content-Type-Options":"nosniff", "Referrer-Policy":"no-referrer", "Permissions-Policy":"camera=(), microphone=(), geolocation=()"};
const json = (value, status=200) => Response.json(value,{status,headers});
export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    if(request.method!=="GET") return json({error:"Method not allowed"},405);
    if(url.pathname==="/api/data") {
      // The Sites owner-private policy protects every route at the hosting boundary.
      const token=env.VAULT_READ_TOKEN || request.headers.get("X-Vault-Token");
      if(!token) return json({error:"请点击“连接仓库”使用只读 Token，或导入 data/dashboard.json。"},503);
      try {
        const response=await fetch("https://api.github.com/repos/Anson-He/github-traffic-vault/contents/data/dashboard.json",{
          headers:{Authorization:"Bearer "+token,Accept:"application/vnd.github.raw+json", "X-GitHub-Api-Version":"2026-03-10","User-Agent":"github-traffic-vault-dashboard"},
          redirect:"error",signal:AbortSignal.timeout(25000)});
        if(!response.ok) return json({error:response.status===404?"尚未找到档案。请确认首次采集已成功，且只读 Token 包含统计仓库的 Contents 权限。":response.status===401?"Token 无效或已过期，请重新连接。":response.status===403?"GitHub 拒绝访问，请检查 Token 权限或 API 限流。":"GitHub 暂时无法读取档案。"},response.status===404?404:502);
        if(Number(response.headers.get("Content-Length")||0)>20*1024*1024)return json({error:"档案超过 20 MB，请按年份拆分。"},413);
        const payload=await response.json();
        if(payload?.schema_version!==1||!Array.isArray(payload.repositories))return json({error:"档案格式不兼容。"},502);
        return json(payload);
      } catch {return json({error:"读取 GitHub 超时或网络异常，请稍后重试。"},502)}
    }
    if(url.pathname!=="/"&&url.pathname!=="/index.html")return new Response("Not found",{status:404,headers});
    return new Response(HTML,{headers:{...headers,"Content-Type":"text/html; charset=utf-8", "Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'"}});
  }
};
