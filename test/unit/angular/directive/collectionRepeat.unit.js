describe('collectionRepeat', function() {

  var el;
  beforeEach(module('ionic', function($provide) {
    $provide.decorator('$$rAF', function($delegate) {
      return function mockRaf(callback) { callback(); };
    });
    spyOn(ionic, 'animationFrameThrottle').andCallFake(function(cb) {
      return function fakeThrottled() {
        cb.apply(this, arguments);
      };
    });
    spyOn(ionic, 'debounce').andCallFake(function(cb) { return cb; });
  }));

  var scrollView;
  function setup(listData, attrs, scrollViewData) {
    var content = angular.element('<content>')
    scrollView = angular.extend({
      __content: content[0],
      __clientHeight: 100,
      __clientWidth: 50,

      __scrollTop: 0,
      __scrollLeft: 0,
      __maxScrollTop: 100,
      __maxScrollLeft: 50,

      options: {
        scrollingY: true
      },
      __callback: angular.noop,
      resize: angular.noop,
      setDimensions: angular.noop
    }, scrollViewData || {});
    var scrollCtrl = {
      scrollView: scrollView,
      $element: content
    };

    var list = [];
    if (angular.isNumber(listData)) {
      for (var i = 0; i < listData; i++) list.push(i);
    } else if (angular.isArray(listData)) {
      list = listData;
    }

    var element;
    inject(function($compile, $rootScope) {
      attrs = attrs || '';
      if (!/item-height/.test(attrs)) attrs += ' item-height="25px"';
      if (!/item-render-buffer/.test(attrs)) attrs += ' item-render-buffer="0"';
      element = angular.element(
        '<div collection-repeat="item in list" '+(attrs)+'>{{item}}</div>'
      );
      content.append(element);
      content.data('$$ionicScrollController', scrollCtrl);
      $rootScope.list = list;
      $compile(element)($rootScope);
      $rootScope.$apply();
      content.triggerHandler('scroll.init');
      $rootScope.$apply();
    });
    return element;
  }

  function scrollTo(n) {
    if (scrollView.options.scrollingY) {
      scrollView.__scrollTop = n;
      scrollView.__maxScrollTop = scrollView.options.getContentHeight() - scrollView.__clientHeight;
    } else {
      scrollView.__scrollLeft = n;
      scrollView.__maxScrollLeft = scrollView.options.getContentWidth() - scrollView.__clientWidth;
    }
    scrollView.__callback();
  }

  function getItems() {
    return [].slice.call(scrollView.__content.querySelectorAll('[collection-repeat]'))
      .map(function(node) {
        return angular.element(node).data('$$collectionRepeatItem')
      })
      // make sure we didn't get anything that doesn't actually have the data
      .filter(function(item) {
        return !!item;
      });
  }
  function activeItems() {
    var items = getItems().filter(function(item) {
      return item.isShown;
    });
    //Group items by their primary position, sort those groups by secondary position,
    //then concat them all together.
    var activeItems = {};
    var result = [];
    items.forEach(function(item) {
      (activeItems[item.primaryPos] || (activeItems[item.primaryPos] = [])).push(item);
    });
    for (var primaryPos in activeItems) {
      activeItems[primaryPos] = activeItems[primaryPos].sort(function(a,b) {
        return a.secondaryPos > b.secondaryPos ? 1 : -1;
      });
    }
    for (var primaryPos in activeItems) {
      result = result.concat(activeItems[primaryPos]);
    }
    return result;
  }
  function activeItemContents() {
    return activeItems().map(function(item) {
      return item.node.innerHTML.trim();
    });
  }
  function activeItemIds() {
    return activeItems().map(function(item) {
      return item.id;
    });
  }

  function activeItemDimensions() {
    return activeItems().map(function(item) {
      return scrollView.options.scrollingX ?  (
        'x:' + item.primaryPos + ',y:' + item.secondaryPos +
        ',w:' + item.primarySize + ',h:' + item.secondarySize
      ) : (
        'x:' + item.secondaryPos + ',y:' + item.primaryPos +
        ',w:' + item.secondarySize + ',h:' + item.primarySize
      );
    });
  }

  it('should error with direction="xy" parent', function() {
    expect(function() {
      setup(10, '', {
        options: { scrollingX: true, scrollingY: true }
      });
    }).toThrow();
  });

  it('should error without proper collection-repeat expression', inject(function($compile, $rootScope) {
    expect(function() {
      $compile('<ion-content>' +
               '<div collection-repeat="bad"></div>' +
               '</ion-content>')($rootScope);
    }).toThrow();
  }));


  it('should destroy', inject(function($compile, $rootScope) {
    var scope = $rootScope.$new();
    var content = $compile('<ion-content>' +
             '<div collection-repeat="item in items" item-height="5" item-width="5"></div>' +
             '</ion-content>')(scope);
    $rootScope.$apply();
    content.triggerHandler('scroll.init');
    scope.$destroy();
  }));

  describe('horizontal static list', function() {
    beforeEach(function() {
      setup(10, 'item-height="100%" item-width="30"', {
        options: {
          scrollingX: true,
          scrollingY: false
        },
        __clientWidth: 80,
        __clientHeight: 25
      });
    });
    it('should show initial screen of items', function() {
      expect(activeItems().length).toBe(3);
      expect(activeItemContents()).toEqual(['0','1','2'])
    });
    it('should switch out as you scroll', function() {
      expect(activeItems().length).toBe(3);
      expect(activeItemContents()).toEqual(['0','1','2'])
      expect(activeItemIds()).toEqual(['item0','item1','item2']);

      // Item 0 gets sent down to the bottom after scrolling past it
      scrollTo(31);
      expect(activeItems().length).toBe(3);
      expect(activeItemContents()).toEqual(['1','2','3'])
      expect(activeItemIds()).toEqual(['item1','item2','item0']);

      // Item 1 gets sent down
      scrollTo(61);
      expect(activeItems().length).toBe(3);
      expect(activeItemContents()).toEqual(['2','3','4'])
      expect(activeItemIds()).toEqual(['item2','item0','item1']);
    });
    it('should start with the same items when resizing', inject(function($window) {
      scrollTo(31);
      scrollTo(61);

      expect(activeItems().length).toBe(3);
      expect(activeItemContents()).toEqual(['2','3','4'])
      expect(activeItemIds()).toEqual(['item2','item0','item1']);

      scrollView.__clientWidth = 50;
      scrollView.__clientHeight = 40;
      angular.element($window).triggerHandler('resize');

      expect(activeItems().length).toBe(2);
      expect(activeItemContents()).toEqual(['2','3'])
      expect(activeItemIds()).toEqual(['item2','item0']);
    }));
  });

  describe('vertical static list', function() {
    beforeEach(function() {
      setup(10);
    });

    it('should show initial screen of items', function() {
      expect(activeItems().length).toBe(5);
      expect(activeItemContents()).toEqual(['0','1','2','3','4'])
    });

    it('should switch out as you scroll', function() {
      expect(activeItems().length).toBe(5);
      expect(activeItemContents()).toEqual(['0','1','2','3','4'])
      expect(activeItemIds()).toEqual(['item0','item1','item2','item3','item4']);

      // Item 0 gets sent down to the bottom after scrolling past it
      scrollTo(26);
      expect(activeItems().length).toBe(5);
      expect(activeItemContents()).toEqual(['1','2','3','4','5'])
      expect(activeItemIds()).toEqual(['item1','item2','item3','item4','item0']);

      // Item 1 gets sent down
      scrollTo(51);
      expect(activeItems().length).toBe(5);
      expect(activeItemContents()).toEqual(['2','3','4','5','6'])
      expect(activeItemIds()).toEqual(['item2','item3','item4','item0','item1']);

      // scroll to bottom incrementally
      // items are traded our until it's the first case again
      scrollTo(76);
      scrollTo(101);
      scrollTo(126);
      expect(activeItems().length).toBe(5);
      expect(activeItemContents()).toEqual(['5','6','7','8','9'])
      expect(activeItemIds()).toEqual(['item0','item1','item2','item3','item4']);
    });

    it('should start with the same items when resizing', inject(function($window) {
      scrollTo(26);
      scrollTo(51);

      expect(activeItems().length).toBe(5);
      expect(activeItemContents()).toEqual(['2','3','4','5','6'])
      expect(activeItemIds()).toEqual(['item2','item3','item4','item0','item1']);

      scrollView.__clientWidth = 200;
      scrollView.__clientHeight = 40;
      angular.element($window).triggerHandler('resize');

      expect(activeItems().length).toBe(2);
      expect(activeItemContents()).toEqual(['2','3'])
      expect(activeItemIds()).toEqual(['item2','item3']);
    }));

  });

  describe('vertical static grid', function() {
    beforeEach(function() {
      setup(10, 'item-width="33%" item-height="25"', {
        __clientWidth: 120,
        __clientHeight: 30
      });
    });

    it('should show initial screen of items', function() {
      expect(activeItems().length).toBe(3 * 2);
      expect(activeItemContents()).toEqual(['0','1','2','3','4','5'])
    });

    it('should switch out as you scroll', function() {
      expect(activeItems().length).toBe(6);
      expect(activeItemContents()).toEqual(['0','1','2','3','4','5'])
      expect(activeItemIds().sort()).toEqual(['item0','item1','item2','item3','item4','item5']);

      scrollTo(26);
      expect(activeItems().length).toBe(6);
      expect(activeItemContents()).toEqual(['3','4','5','6','7','8'])
      expect(activeItemIds().sort()).toEqual(['item0','item1','item2','item3','item4','item5']);

      scrollTo(51);
      expect(activeItems().length).toBe(4);
      expect(activeItemContents()).toEqual(['6','7','8','9'])
      expect(activeItemIds().sort()).toEqual(['item0','item1','item2','item5']);
    });

    it('should start with the same items when resizing', inject(function($window) {
      scrollTo(26);

      expect(activeItems().length).toBe(6);
      expect(activeItemContents()).toEqual(['3','4','5','6','7','8'])
      expect(activeItemIds().sort()).toEqual(['item0','item1','item2','item3','item4','item5']);

      scrollView.__clientWidth = 200;
      scrollView.__clientHeight = 20;
      angular.element($window).triggerHandler('resize');

      expect(activeItems().length).toBe(3);
      expect(activeItemContents()).toEqual(['3','4','5'])
      expect(activeItemIds().sort()).toEqual(['item3','item4','item5']);
    }));
  });

  describe('vertical dynamic grid', function() {
    beforeEach(function() {
      // Odd rows 25 height, even rows 50 height
      setup(10, 'item-width="(16 * (1+($index % 5))) + \'%\'" ' +
                'item-height="($index % 2) ? 25 : 50"', {
        __clientWidth: 100,
        __clientHeight: 60
      });
    });

    it('should show initial screen of items', function() {
      // row 0, index 0: 50 height, 3 items (widths 16%, 32%, 48%)
      // row 1, index 3: 25 height, 2 items (widths 64%)
      expect(activeItems().length).toBe(4);
      expect(activeItemContents()).toEqual(['0','1','2','3'])

      var dim = activeItemDimensions();
      //Row 0
      expect(dim[0]).toBe('x:0,y:0,w:16,h:50');
      expect(dim[1]).toBe('x:16,y:0,w:32,h:50');
      expect(dim[2]).toBe('x:48,y:0,w:48,h:50');
      // Row 1
      expect(dim[3]).toBe('x:0,y:50,w:64,h:25');
    });

    it('should switch out as you scroll', function() {
      // Scroll past row 0, height 50
      scrollTo(51);
      // row 1, index 3: 25 height, 1 item (width 64%)
      // row 2, index 4: 50 height, 2 items (width 80%, 16%)
      expect(activeItems().length).toBe(3);
      expect(activeItemContents()).toEqual(['3','4','5'])
      expect(activeItemIds().sort()).toEqual(['item1','item2','item3']);

      var dim = activeItemDimensions();
      //Row 1
      expect(dim[0]).toBe('x:0,y:50,w:64,h:25');
      //Row 2
      expect(dim[1]).toBe('x:0,y:75,w:80,h:50');
      expect(dim[2]).toBe('x:80,y:75,w:16,h:50');

      // row 3, index 6: 50 height, 2 items (width 32%, 48%)

      //Scroll past row 2 and row 3 to the end
      scrollTo(176);
      // row 4, index 8: 50 height, 1 item (width 64%)
      // row 5, index 9: 25 height, 2 items (width 80%, 16%)
      expect(activeItems().length).toBe(2);
      expect(activeItemContents()).toEqual(['8', '9'])

      var dim = activeItemDimensions();
      //Row 3
      expect(dim[0]).toBe('x:0,y:175,w:64,h:50');
      //Row 4
      expect(dim[1]).toBe('x:0,y:225,w:80,h:25');
    });

    it('should start with the same items when resizing', inject(function($window) {
      // Scroll past row 0, height 50
      scrollTo(51);
      // row 1, index 3: 25 height, 1 item (width 64%)
      // row 2, index 4: 50 height, 2 items (width 80%, 16%)
      expect(activeItems().length).toBe(3);
      expect(activeItemContents()).toEqual(['3','4','5'])
      expect(activeItemIds().sort()).toEqual(['item1','item2','item3']);

      scrollView.__clientWidth = 50;
      scrollView.__clientHeight = 50;
      angular.element($window).triggerHandler('resize');

      expect(activeItems().length).toBe(3);
      expect(activeItemContents()).toEqual(['3','4','5'])
      expect(activeItemIds().sort()).toEqual(['item1','item2','item3']);
    }));
  });

});
