import requests
import os

# 设置保存图片的文件夹名称
save_dir = "Identity_Skill_Icons"
os.makedirs(save_dir, exist_ok=True)

# Limbus Company Wiki 的 API 地址
url = "https://limbuscompany.wiki.gg/api.php"

# API 请求参数
params = {
    "action": "query",
    "format": "json",
    "generator": "categorymembers",
    "gcmtitle": "Category:Identity_Skill_Icons", # 你要下载的分类名
    "gcmlimit": "500", # 每次请求获取的最大数量
    "gcmtype": "file",
    "prop": "imageinfo",
    "iiprop": "url" # 获取图片的直链 URL
}

print("开始连接 Wiki API 获取高清图片列表...")

while True:
    response = requests.get(url, params=params).json()
    pages = response.get("query", {}).get("pages", {})
    
    for page_id, page_info in pages.items():
        # 清理文件名，去掉 "File:" 前缀，并替换掉可能导致路径错误的斜杠
        title = page_info["title"].replace("File:", "").replace("/", "_")
        image_info = page_info.get("imageinfo", [{}])[0]
        image_url = image_info.get("url")
        
        if image_url:
            print(f"正在下载: {title}")
            try:
                img_data = requests.get(image_url).content
                with open(os.path.join(save_dir, title), 'wb') as f:
                    f.write(img_data)
            except Exception as e:
                print(f"下载失败 {title}: {e}")
    
    # 检查是否有下一页，如果有则继续请求
    if 'continue' in response:
        params.update(response['continue'])
    else:
        break

print(f"全部下载完成！文件已保存在 {save_dir} 文件夹中。")