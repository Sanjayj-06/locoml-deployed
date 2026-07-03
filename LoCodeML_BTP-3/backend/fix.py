import os

for root, _, files in os.walk('.'):
    for f in files:
        if f.endswith('.py'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            modified = False
            if "sys.path.append(os.getenv('PROJECT_PATH', ''))" in content:
                content = content.replace("sys.path.append(os.getenv('PROJECT_PATH', ''))", "sys.path.append(os.getenv('PROJECT_PATH', ''))")
                modified = True
            
            if 'sys.path.append(os.getenv("PROJECT_PATH", ""))' in content:
                content = content.replace('sys.path.append(os.getenv("PROJECT_PATH", ""))', 'sys.path.append(os.getenv("PROJECT_PATH", ""))')
                modified = True
                
            if modified:
                with open(path, 'w', encoding='utf-8') as file:
                    file.write(content)
                print(f'Fixed {path}')
