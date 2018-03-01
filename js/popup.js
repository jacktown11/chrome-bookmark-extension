(function(w) {
    let doc = document,
        localStorage = w.localStorage;

    let Utils = {
        self: this,
        uniqueStr: 'bookmark-',
        addClass: function (ele, cls) {
            if (ele.className.indexOf(cls) === -1) {
                ele.className = ele.className.trim() + ' ' + cls;
            }
        },
        removeClass: function (ele, cls) {
            let tmp = ele.className;
            while(tmp.indexOf(cls) !== -1){
                tmp = tmp.replace(cls, ' ');
            }
            tmp = tmp.trim().replace(/\s{2,}/g, ' ');
            ele.className = tmp;
        },
        toggleClass (ele, cls) {
            if(ele.className.indexOf(cls) === -1){
                self.addClass(ele, cls);
            }else{
                self.removeClss(ele, cls);
            }
        },
        storeSet (key, value) {
            localStorage.setItem(self.uniqueStr + key, value);
        },
        storeGet (key){
            return parseInt(localStorage.getItem(self.uniqueStr + key));
        },
        storeRemove (key) {
            localStorage.getItem(self.uniqueStr + key);
        }
    },
    BM = {
        data: [], // 书签数据
        searchRes: {str: '', result: []},  // 书签搜索结果
        getBookmarkData (callback) {
            let self = this,
                storeGet = Utils.storeGet,
                storeSet = Utils.storeSet;
            chrome.bookmarks.getTree(function(res){
                let top = res[0],
                    addChildren = function(node){
                        let children = node.children || [];
                        res = res.concat(children);
                        if(children.length > 0 && !children.every(function(item) {
                            return !item.children;
                        })){
                            children.forEach(function(item) {
                                if(item.children){
                                    addChildren(item);                            
                                }
                            });
                        }
                    };
                res.push(top);
                addChildren(top);
                
                // filter out file directory item
                self.data = res.filter(function(item){
                    return !item.children;
                });

                // get the visited number of each url
                self.data.forEach(function(item){
                    if (!storeGet(item.url)) {
                        storeSet(item.url, '0');
                    }
                });

                callback && callback();
            });
        },
        searchFrom (searchStr, src) {
            // src 可能是整个书签或上次搜索结果数据

            let targetStr = searchStr.trim(),
                res,
                storeGet = Utils.storeGet;
            res = src.filter(function(item,index,arr){
                let pos = (item.title + item.url)
                        .toLowerCase()
                        .indexOf(targetStr.toLowerCase());
               if(pos === 0 && searchStr !== ''){
                    item.goodMatch = true;
                }else{
                    item.goodMatch = false;
                }
                return pos > -1;
            });
            res.forEach(function(item,index, arr) {
                item.visitedNum = storeGet(item.url);
            });
            res.sort(function(item1, item2){
                if(item1.goodMatch){
                    if(item2.goodMatch){
                        return item2.visitedNum - item1.visitedNum;
                    }else{
                        return -1;
                    }
                }else{
                    if(item2.goodMatch){
                        return 1;
                    }else{
                        return item2.visitedNum - item1.visitedNum;
                    }
                }
            });

            this.searchRes.result = res;
            this.searchRes.str = searchStr;
        },
        showSearchRes () {
            let ul = doc.getElementById('search-result'),
                frag = doc.createDocumentFragment(),
                res = this.searchRes.result;
            res.forEach(function(item, index, arr){
                let li = doc.createElement('li');
                li.innerHTML = '<span class="bookmark-title">' +
                        item.title +
                        '</span><br><span class="bookmark-url">' +
                        item.url +
                        '</span>';
                li.setAttribute('data-url', item.url);
                li.setAttribute('data-pos', index);
                frag.appendChild(li);
            });
            ul.innerHTML = '';
            ul.appendChild(frag);
            if(ul.firstChild){
                ul.firstChild.className = 'choosed';
            }
        },
        search (searchStr){
            // isTight Boolean 表示是否基于上次搜索结果筛选(否则会从所有浏览器书签中筛选)
            let oldRes = this.searchRes.result,
                oldStr = this.searchRes.str,
                src = oldStr && searchStr.indexOf(oldStr) === 0 ? 
                    oldRes.concat() :
                    this.data.concat();
            this.searchFrom(searchStr, src);
            this.showSearchRes();
        }
    },
    App = {
        self: this,
        init () {
            let self = this;

            BM.getBookmarkData(function(){
                // console.log(BM.data);
                doc.getElementById('search-input').focus();
                self.setHandler();
                BM.search('');
            });
        },
        responseKeydown (event){
            let ul = doc.getElementById('search-result'),
                li = doc.getElementsByClassName('choosed')[0],
                height = 50, //li item's height (border-box)
                url = li.getAttribute('data-url'),
                key = {
                    up: 38,
                    down: 40
                },
                Ut = Utils;
            if(event.keyCode === key.down){
                let next = li.nextSibling;
                Ut.removeClass(li, 'choosed');
                if(!!next){
                    Ut.addClass(next, 'choosed');
                    if ((li.getAttribute('data-pos')-9) * height - ul.scrollTop >= 0) {
                        ul.scrollTop += height;
                    }
                }else{
                    // the last item
                    let firstLi = ul.firstChild;
                    Ut.addClass(firstLi, 'choosed');
                    ul.scrollTop = 0;
                }
            }else if(event.keyCode === key.up){
                let prev = li.previousSibling;
                Ut.removeClass(li, 'choosed');
                if (!!prev) {
                    Ut.addClass(prev, 'choosed');
                    if (li.getAttribute('data-pos') * height -ul.scrollTop <= 0) {
                        ul.scrollTop -= height;
                    }
                }else{
                    // the first item
                    let lastLi = ul.lastChild;
                    Ut.addClass(lastLi, 'choosed');
                    ul.scrollTop = Math.max(0, lastLi.getAttribute('data-pos')-9) * height;
                }
            }
        },
        setHandler(){
           let inputNode = doc.getElementById('search-input');
           inputNode.addEventListener('input', ()=>{
                let inputNode = doc.getElementById('search-input'),
                    searchStr = inputNode.value;
                BM.search(searchStr);
           });
           doc.addEventListener('keydown', (event) => {
               let keyCode = event.keyCode;
               if(keyCode === 38 || keyCode === 40){
                   event.preventDefault();
                   this.responseKeydown(event);
               }
           });
           doc.addEventListener('keyup', (event) => {
               let keyCode = event.keyCode;
               if(keyCode === 13){
                    // enter keyup
                    let li = doc.getElementsByClassName('choosed')[0],
                        url = li.getAttribute('data-url');
                    Utils.storeSet(url, (Utils.storeGet(url) || 0) + 1);
                    chrome.tabs.create({ url });
               }  
           })
        }
    };

    App.init();

})(window);
